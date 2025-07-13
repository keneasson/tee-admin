import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { randomUUID } from 'crypto'
import { getAwsDbConfig } from '../email/sesClient'
import { hashPassword, verifyPassword } from '../password'
import { generateSecureToken, generateInvitationCode, isTokenExpired } from '../tokens'
import { ROLES } from '@my/app/provider/auth/auth-roles'

const dbClientConfig = getAwsDbConfig()
const client = DynamoDBDocument.from(new DynamoDB(dbClientConfig), {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
})

const TABLE_NAME = 'tee-admin'

export interface CredentialsUser {
  id: string
  email: string
  hashedPassword: string
  name: string
  firstName: string
  lastName: string
  ecclesia: string
  role: string
  emailVerified?: Date
  provider: 'credentials'
  createdAt: Date
}

export interface InvitationCode {
  code: string
  firstName: string
  lastName: string
  ecclesia: string
  role: string
  createdBy: string
  createdAt: Date
  expiresAt: Date
  used: boolean
  usedBy?: string
  usedAt?: Date
}

export interface VerificationToken {
  token: string
  email: string
  type: 'email_verification' | 'password_reset'
  createdAt: Date
  expiresAt: Date
}

export async function createCredentialsUser(data: {
  email: string
  password: string
  firstName: string
  lastName: string
  ecclesia: string
  role?: string
  invitationCode?: string
}): Promise<CredentialsUser> {
  // Check if ANY user already exists with this email (any provider)
  const existingAnyUser = await findAnyUserByEmail(data.email)
  if (existingAnyUser) {
    throw new Error('User with this email already exists. Please sign in with your existing account or use a different email.')
  }
  
  // Check if credentials user specifically exists
  const existingUser = await findCredentialsUserByEmail(data.email)
  if (existingUser) {
    throw new Error('User with this email already exists')
  }

  const userId = randomUUID()
  const hashedPassword = await hashPassword(data.password)
  const now = new Date()
  
  const user: CredentialsUser = {
    id: userId,
    email: data.email,
    hashedPassword,
    name: `${data.firstName} ${data.lastName}`,
    firstName: data.firstName,
    lastName: data.lastName,
    ecclesia: data.ecclesia,
    role: data.role || ROLES.GUEST,
    provider: 'credentials',
    createdAt: now,
  }

  // Store user in DynamoDB with condition to prevent duplicates
  await client.put({
    TableName: TABLE_NAME,
    Item: {
      pkey: `USER#${userId}`,
      skey: `USER#${userId}`,
      gsi1pk: `USER#${data.email}`,
      gsi1sk: `USER#${data.email}`,
      type: 'USER',
      ...user,
    },
    ConditionExpression: 'attribute_not_exists(pkey)',
  })

  // Mark invitation code as used if provided
  if (data.invitationCode) {
    await markInvitationCodeAsUsed(data.invitationCode, userId)
  }

  return user
}

export async function findCredentialsUserByEmail(email: string): Promise<CredentialsUser | null> {
  try {
    const result = await client.query({
      TableName: TABLE_NAME,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`,
      },
    })

    if (result.Items && result.Items.length > 0) {
      // Look through all items to find the credentials user
      for (const item of result.Items) {
        if (item.provider === 'credentials') {
          return item as CredentialsUser
        }
      }
    }
    return null
  } catch (error) {
    console.error('Error finding credentials user:', error)
    return null
  }
}

export async function findAnyUserByEmail(email: string): Promise<any | null> {
  try {
    // Use scan to find any user with this email (regardless of provider)
    const result = await client.scan({
      TableName: TABLE_NAME,
      FilterExpression: 'email = :email AND #type = :userType',
      ExpressionAttributeValues: {
        ':email': email,
        ':userType': 'USER'
      },
      ExpressionAttributeNames: {
        '#type': 'type'
      }
    })

    if (result.Items && result.Items.length > 0) {
      console.log('🔍 Found existing user with email:', email, 'provider:', result.Items[0].provider)
      return result.Items[0]
    }
    return null
  } catch (error) {
    console.error('Error finding any user by email:', error)
    return null
  }
}

export async function verifyCredentialsUser(email: string, password: string): Promise<CredentialsUser | null> {
  console.log('verifyCredentialsUser: Attempting sign-in for:', email)
  
  const user = await findCredentialsUserByEmail(email)
  if (!user) {
    console.log('verifyCredentialsUser: No user found for email:', email)
    return null
  }

  console.log('verifyCredentialsUser: User found, checking password...')
  
  const isValid = await verifyPassword(password, user.hashedPassword)
  if (!isValid) {
    console.log('verifyCredentialsUser: Invalid password for:', email)
    return null
  }

  console.log('verifyCredentialsUser: Password valid, checking email verification...')
  console.log('verifyCredentialsUser: emailVerified value:', user.emailVerified, typeof user.emailVerified)
  
  // Check if email is verified - handle various data types
  const isEmailVerified = user.emailVerified && (
    user.emailVerified instanceof Date || 
    typeof user.emailVerified === 'string' ||
    typeof user.emailVerified === 'number'
  )
  
  if (!isEmailVerified) {
    console.log('verifyCredentialsUser: Email not verified for:', email, 'emailVerified:', user.emailVerified)
    return null
  }

  console.log('verifyCredentialsUser: User verified successfully for:', email)
  return user
}

export async function createEmailVerificationToken(email: string): Promise<string> {
  const token = generateSecureToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await client.put({
    TableName: TABLE_NAME,
    Item: {
      pkey: `VERIFY_TOKEN#${token}`,
      skey: `VERIFY_TOKEN#${token}`,
      type: 'VERIFICATION_TOKEN',
      token,
      email,
      tokenType: 'email_verification',
      createdAt: now,
      expiresAt,
    },
  })

  return token
}

export async function verifyEmailToken(token: string): Promise<{ email: string } | null> {
  try {
    const result = await client.get({
      TableName: TABLE_NAME,
      Key: {
        pkey: `VERIFY_TOKEN#${token}`,
        skey: `VERIFY_TOKEN#${token}`,
      },
    })

    if (!result.Item) return null

    const tokenData = result.Item as VerificationToken & { tokenType: string }
    
    // Check if token is expired
    if (isTokenExpired(tokenData.createdAt)) {
      return null
    }

    // Check if it's the right type
    if (tokenData.tokenType !== 'email_verification') {
      return null
    }

    // First, get the user ID from the email
    const userResult = await client.query({
      TableName: TABLE_NAME,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${tokenData.email}`,
      },
    })

    if (userResult.Items && userResult.Items.length > 0) {
      const userId = userResult.Items[0].id
      console.log('verifyEmailToken: Marking user as verified:', userId, 'for email:', tokenData.email)
      
      // Mark user as verified using the primary key
      await client.update({
        TableName: TABLE_NAME,
        Key: {
          pkey: `USER#${userId}`,
          skey: `USER#${userId}`,
        },
        UpdateExpression: 'SET emailVerified = :now',
        ExpressionAttributeValues: {
          ':now': new Date(),
        },
      })
      
      console.log('verifyEmailToken: User marked as verified successfully')
    } else {
      console.log('verifyEmailToken: No user found for email:', tokenData.email)
    }

    // Delete the verification token
    await client.delete({
      TableName: TABLE_NAME,
      Key: {
        pkey: `VERIFY_TOKEN#${token}`,
        skey: `VERIFY_TOKEN#${token}`,
      },
    })

    return { email: tokenData.email }
  } catch (error) {
    console.error('Error verifying email token:', error)
    return null
  }
}

export async function createInvitationCode(data: {
  firstName: string
  lastName: string
  ecclesia: string
  role: string
  createdBy: string
}): Promise<string> {
  const code = generateInvitationCode()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await client.put({
    TableName: TABLE_NAME,
    Item: {
      pkey: `INVITE_CODE#${code}`,
      skey: `INVITE_CODE#${code}`,
      type: 'INVITATION_CODE',
      code,
      firstName: data.firstName,
      lastName: data.lastName,
      ecclesia: data.ecclesia,
      role: data.role,
      createdBy: data.createdBy,
      createdAt: now,
      expiresAt,
      used: false,
    },
  })

  return code
}

export async function validateInvitationCode(code: string): Promise<InvitationCode | null> {
  try {
    const result = await client.get({
      TableName: TABLE_NAME,
      Key: {
        pkey: `INVITE_CODE#${code}`,
        skey: `INVITE_CODE#${code}`,
      },
    })

    if (!result.Item) return null

    const inviteData = result.Item as InvitationCode

    // Check if code is expired
    if (isTokenExpired(inviteData.createdAt)) {
      return null
    }

    // Check if code is already used
    if (inviteData.used) {
      return null
    }

    return inviteData
  } catch (error) {
    console.error('Error validating invitation code:', error)
    return null
  }
}

export async function markInvitationCodeAsUsed(code: string, userId: string): Promise<void> {
  await client.update({
    TableName: TABLE_NAME,
    Key: {
      pkey: `INVITE_CODE#${code}`,
      skey: `INVITE_CODE#${code}`,
    },
    UpdateExpression: 'SET used = :used, usedBy = :userId, usedAt = :now',
    ExpressionAttributeValues: {
      ':used': true,
      ':userId': userId,
      ':now': new Date(),
    },
  })
}

export async function createPasswordResetToken(email: string): Promise<string> {
  const token = generateSecureToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await client.put({
    TableName: TABLE_NAME,
    Item: {
      pkey: `RESET_TOKEN#${token}`,
      skey: `RESET_TOKEN#${token}`,
      type: 'PASSWORD_RESET_TOKEN',
      token,
      email,
      tokenType: 'password_reset',
      createdAt: now,
      expiresAt,
    },
  })

  return token
}

export async function validatePasswordResetToken(token: string): Promise<{ email: string } | null> {
  try {
    const result = await client.get({
      TableName: TABLE_NAME,
      Key: {
        pkey: `RESET_TOKEN#${token}`,
        skey: `RESET_TOKEN#${token}`,
      },
    })

    if (!result.Item) {
      return null
    }

    const tokenData = result.Item as VerificationToken & { tokenType: string }
    
    // Check if token is expired
    if (isTokenExpired(tokenData.createdAt)) {
      return null
    }

    // Check if it's the right type
    if (tokenData.tokenType !== 'password_reset') {
      return null
    }

    return { email: tokenData.email }
  } catch (error) {
    console.error('Error validating password reset token:', error)
    return null
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  try {
    const tokenData = await validatePasswordResetToken(token)
    if (!tokenData) return false

    const hashedPassword = await hashPassword(newPassword)

    // First, get the user ID from the email
    const userResult = await client.query({
      TableName: TABLE_NAME,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${tokenData.email}`,
      },
    })

    if (!userResult.Items || userResult.Items.length === 0) {
      return false
    }

    const userId = userResult.Items[0].id

    // Update user password using the primary key
    await client.update({
      TableName: TABLE_NAME,
      Key: {
        pkey: `USER#${userId}`,
        skey: `USER#${userId}`,
      },
      UpdateExpression: 'SET hashedPassword = :password',
      ExpressionAttributeValues: {
        ':password': hashedPassword,
      },
    })

    // Delete the reset token
    await client.delete({
      TableName: TABLE_NAME,
      Key: {
        pkey: `RESET_TOKEN#${token}`,
        skey: `RESET_TOKEN#${token}`,
      },
    })

    return true
  } catch (error) {
    console.error('Error resetting password:', error)
    return false
  }
}