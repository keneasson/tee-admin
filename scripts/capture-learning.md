# Learning Capture Template

Use this template when adding new learnings to `DEVELOPMENT_LEARNINGS.md`:

## Template

```markdown
### **[Learning Title] ([Date])**

#### **The Problem**
[Describe what went wrong - include error messages, unexpected behavior, etc.]

#### **Root Cause**
[Technical explanation of why it happened]

#### **Solution**
```typescript
// ✅ Working code example
```

#### **Prevention Strategy**
1. [Step 1 to avoid this issue]
2. [Step 2 to avoid this issue]
3. [Step 3 to avoid this issue]

#### **Related Issues**
- [Link to similar problems or documentation]
```

## Example Usage

When you encounter a significant issue or discover an important pattern:

1. **Document immediately** while the details are fresh
2. **Include specific examples** - error messages, code snippets, exact steps
3. **Focus on prevention** - how to avoid this in the future
4. **Link to related resources** - documentation, Stack Overflow, etc.

## Quick Add Process

```bash
# 1. Open the learnings file
code DEVELOPMENT_LEARNINGS.md

# 2. Add new section using template above
# 3. Save and commit with descriptive message
git add DEVELOPMENT_LEARNINGS.md
git commit -m "docs: capture learning about [specific issue]"
```

## What Makes a Good Learning Entry

✅ **Good Learning Entries:**
- Specific technical problem with solution
- Includes working code examples
- Explains the "why" not just the "what"
- Provides prevention strategies
- Will help future developers

❌ **Avoid These:**
- Vague descriptions without details
- One-time issues unlikely to repeat
- Personal preferences without technical merit
- Copy-paste from external docs without context