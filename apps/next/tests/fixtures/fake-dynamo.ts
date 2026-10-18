/**
 * A small in-memory DynamoDB for tests that need real read-after-write
 * behaviour across several items (e.g. projection sync). It understands the
 * expression shapes this codebase actually uses — `a = :v`, `begins_with(a, :v)`
 * joined by AND, `SET`/`REMOVE` updates incl. `if_not_exists(...) + :one`,
 * and `attribute_not_exists(...)` conditions — and nothing more.
 *
 * Wire it with `vi.mock('@aws-sdk/lib-dynamodb', () => fakeLibDynamodb(fake))`.
 * Scan is deliberately counted, so a test can assert a path used none.
 */
type Item = Record<string, any>

export interface FakeDynamo {
  tables: Map<string, Map<string, Item>>
  calls: Array<{ op: string; input: any }>
  send: (command: { __op: string; input: any }) => Promise<any>
  document: Record<string, (input: any) => Promise<any>>
  items: (table?: string) => Item[]
  seed: (items: Item[], table?: string) => void
  reset: () => void
}

const DEFAULT_TABLE = 'tee-admin'
const keyOf = (i: Item) => `${i.pkey}\u0000${i.skey}`

function resolveName(token: string, names: Record<string, string> = {}) {
  return token.startsWith('#') ? names[token] : token
}

function matchClauses(item: Item, expr: string | undefined, names: Record<string, string>, values: Record<string, any>) {
  if (!expr) return true
  return expr.split(/\s+AND\s+/i).every((clause) => {
    const c = clause.trim()
    let m = c.match(/^begins_with\(\s*([#\w]+)\s*,\s*(:\w+)\s*\)$/i)
    if (m) {
      const v = item[resolveName(m[1], names)]
      return typeof v === 'string' && v.startsWith(values[m[2]])
    }
    m = c.match(/^attribute_not_exists\(\s*([#\w]+)\s*\)$/i)
    if (m) return item[resolveName(m[1], names)] === undefined
    m = c.match(/^([#\w]+)\s*=\s*(:\w+)$/)
    if (m) return item[resolveName(m[1], names)] === values[m[2]]
    throw new Error(`fake-dynamo: unsupported expression clause "${c}"`)
  })
}

function applyUpdate(item: Item, input: any) {
  const names = input.ExpressionAttributeNames || {}
  const values = input.ExpressionAttributeValues || {}
  const expr: string = input.UpdateExpression
  const [, setPart = '', removePart = ''] = expr.match(/^\s*SET\s+(.*?)(?:\s+REMOVE\s+(.*))?$/i) || []
  if (!setPart && /^\s*REMOVE/i.test(expr)) {
    for (const n of expr.replace(/^\s*REMOVE\s+/i, '').split(',')) delete item[resolveName(n.trim(), names)]
    return
  }
  const assignments = setPart.split(/,(?![^()]*\))/)
  for (const a of assignments) {
    const m = a.trim().match(/^([#\w]+)\s*=\s*(.+)$/)
    if (!m) throw new Error(`fake-dynamo: unsupported SET "${a}"`)
    const attr = resolveName(m[1], names)
    const rhs = m[2].trim()
    const inc = rhs.match(/^if_not_exists\(\s*([#\w]+)\s*,\s*(:\w+)\s*\)\s*\+\s*(:\w+)$/)
    if (inc) {
      const cur = item[resolveName(inc[1], names)]
      item[attr] = (cur ?? values[inc[2]]) + values[inc[3]]
    } else {
      item[attr] = values[rhs]
    }
  }
  if (removePart) {
    for (const n of removePart.split(',')) delete item[resolveName(n.trim(), names)]
  }
}

export function createFakeDynamo(): FakeDynamo {
  const tables = new Map<string, Map<string, Item>>()
  const calls: Array<{ op: string; input: any }> = []
  const table = (name: string = DEFAULT_TABLE) => {
    if (!tables.has(name)) tables.set(name, new Map())
    return tables.get(name)!
  }
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

  const ops: Record<string, (input: any) => Promise<any>> = {
    async Get(input) {
      const item = table(input.TableName).get(keyOf(input.Key))
      return { Item: item ? clone(item) : undefined }
    },
    async Put(input) {
      const t = table(input.TableName)
      const existing = t.get(keyOf(input.Item))
      if (input.ConditionExpression && existing &&
          !matchClauses(existing, input.ConditionExpression, input.ExpressionAttributeNames, input.ExpressionAttributeValues || {})) {
        const err: any = new Error('The conditional request failed')
        err.name = 'ConditionalCheckFailedException'
        throw err
      }
      const item = clone(input.Item)
      for (const k of Object.keys(item)) if (item[k] === undefined) delete item[k]
      t.set(keyOf(item), item)
      return {}
    },
    async Update(input) {
      const t = table(input.TableName)
      const item = t.get(keyOf(input.Key)) || { ...input.Key }
      applyUpdate(item, input)
      t.set(keyOf(input.Key), item)
      return { Attributes: clone(item) }
    },
    async Delete(input) {
      table(input.TableName).delete(keyOf(input.Key))
      return {}
    },
    async Query(input) {
      const names = input.ExpressionAttributeNames || {}
      const values = input.ExpressionAttributeValues || {}
      const idx = input.IndexName as string | undefined
      const pkAttr = idx ? `${idx}pk` : 'pkey'
      const skAttr = idx ? `${idx}sk` : 'skey'
      let rows = [...table(input.TableName).values()].filter(
        (i) => i[pkAttr] !== undefined && matchClauses(i, input.KeyConditionExpression, names, values)
      )
      if (input.FilterExpression) rows = rows.filter((i) => matchClauses(i, input.FilterExpression, names, values))
      rows.sort((a, b) => String(a[skAttr] ?? '').localeCompare(String(b[skAttr] ?? '')) || keyOf(a).localeCompare(keyOf(b)))
      if (input.ScanIndexForward === false) rows.reverse()
      if (input.Limit) rows = rows.slice(0, input.Limit)
      if (input.Select === 'COUNT') return { Count: rows.length }
      return { Items: clone(rows), Count: rows.length }
    },
    async Scan(input) {
      const names = input.ExpressionAttributeNames || {}
      const values = input.ExpressionAttributeValues || {}
      let rows = [...table(input.TableName).values()]
      if (input.IndexName) rows = rows.filter((i) => i[`${input.IndexName}pk`] !== undefined)
      if (input.FilterExpression) rows = rows.filter((i) => matchClauses(i, input.FilterExpression, names, values))
      return { Items: clone(rows), Count: rows.length }
    },
    async BatchGet(input) {
      const Responses: Record<string, Item[]> = {}
      for (const [name, req] of Object.entries<any>(input.RequestItems)) {
        Responses[name] = req.Keys.map((k: Item) => table(name).get(keyOf(k))).filter(Boolean).map(clone)
      }
      return { Responses, UnprocessedKeys: {} }
    },
  }

  const send = async (command: { __op: string; input: any }) => {
    calls.push({ op: command.__op, input: command.input })
    const fn = ops[command.__op]
    if (!fn) throw new Error(`fake-dynamo: unsupported command ${command.__op}`)
    return fn(command.input)
  }
  const document = {
    get: (input: any) => send({ __op: 'Get', input }),
    put: (input: any) => send({ __op: 'Put', input }),
    update: (input: any) => send({ __op: 'Update', input }),
    delete: (input: any) => send({ __op: 'Delete', input }),
    query: (input: any) => send({ __op: 'Query', input }),
    scan: (input: any) => send({ __op: 'Scan', input }),
    send: (cmd: any) => send(cmd),
  }

  return {
    tables,
    calls,
    send,
    document,
    items: (name = DEFAULT_TABLE) => [...table(name).values()],
    seed: (items, name = DEFAULT_TABLE) => items.forEach((i) => table(name).set(keyOf(i), clone(i))),
    reset: () => {
      tables.clear()
      calls.length = 0
    },
  }
}

/** The `@aws-sdk/lib-dynamodb` module surface, backed by `fake`. */
export function fakeLibDynamodb(fake: FakeDynamo) {
  const command = (op: string) =>
    function (this: any, input: any) {
      return { __op: op, input }
    } as any
  return {
    DynamoDBDocumentClient: { from: () => ({ send: fake.send }) },
    DynamoDBDocument: { from: () => fake.document },
    GetCommand: command('Get'),
    PutCommand: command('Put'),
    UpdateCommand: command('Update'),
    DeleteCommand: command('Delete'),
    QueryCommand: command('Query'),
    ScanCommand: command('Scan'),
    BatchGetCommand: command('BatchGet'),
    BatchWriteCommand: command('BatchWrite'),
  }
}

/** One shared instance, so a `vi.mock` factory and the test see the same store. */
export const sharedFake = createFakeDynamo()
