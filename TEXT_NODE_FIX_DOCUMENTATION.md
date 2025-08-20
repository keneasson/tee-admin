# Text Node Error Fix Documentation

## Problem Description
The user reported a persistent "Unexpected text node" error in the StepSummary component between lines 212-273 of `/packages/ui/src/events/progressive-event-form.tsx`.

## Error Details
- **Error Type**: "Unexpected text node: . A text node cannot be a child of a <View>."
- **Location**: StepSummary component, specifically around conditional JSX rendering
- **Context**: React Native's strict text node requirements

## Root Cause Analysis
The issue was caused by **template string interpolation outside of Text components** in the Review section. React Native interprets template strings that aren't wrapped in Text components as text nodes, which cannot be direct children of View components.

### Primary Issue: Unwrapped Template Strings
The main culprits were template strings directly inside Text components without their own Text wrapper:
```jsx
// PROBLEMATIC - template string creates text node
<Text>
  <Text fontWeight="600">Couple: </Text>
  {`${bride?.firstName || ''} ${bride?.lastName || ''} & ${groom?.firstName || ''} ${groom?.lastName || ''}`}
</Text>
```

### Secondary Issue: Whitespace Around Conditionals
There were also whitespace issues around conditional JSX expressions.

### Problematic Code Pattern
```jsx
// WRONG - Creates whitespace text nodes
{step === 'components' && (
  <XStack>...</XStack>
)}
```

### Correct Code Pattern  
```jsx
// CORRECT - No whitespace text nodes
{step === 'components' && (<XStack>...</XStack>)}
```

## The Fix
### What Was Changed
1. **Wrapped template strings in Text components** (primary fix)
2. **Removed line breaks** around conditional JSX expressions (secondary fix)

### Primary Fix: Template String Wrapping
```jsx
// Before (problematic):
<Text>
  <Text fontWeight="600">Couple: </Text>
  {`${bride?.firstName || ''} & ${groom?.firstName || ''}`}
</Text>

// After (fixed):
<Text>
  <Text fontWeight="600">Couple: </Text>
  <Text>{`${bride?.firstName || ''} & ${groom?.firstName || ''}`}</Text>
</Text>
```

### Secondary Fix: Conditional JSX Formatting
```jsx
// Before (problematic):
{step === 'components' && (
  <XStack space="$4" flexWrap="wrap">
    ...
  </XStack>
)}

// After (fixed):
{step === 'components' && (<XStack space="$4" flexWrap="wrap">
    ...
  </XStack>)}
```

### Files and Lines Fixed
- Line 1233: Candidate name template string
- Line 1255: Date range template string  
- Line 1265: Couple names template string

## Verification Process
1. **Created isolated test route**: `/debug/text-node-test` 
2. **Extracted problematic component**: Isolated StepSummary logic in test page
3. **Tested with populated data**: Verified fix works with normal data
4. **Tested with undefined/empty values**: Verified fix works with edge cases:
   - `selectedType = undefined`
   - `title = ''` (empty string)
   - `theme = null` 
   - `candidate = undefined`
   - Mixed empty/undefined object properties
   - Empty arrays
5. **Confirmed comprehensive fix**: Both test scenarios render successfully without errors
6. **Documented solution**: This document serves as reference for future issues

## Key Learnings
- **React Native text node restrictions**: Any whitespace between JSX elements becomes a text node
- **Conditional JSX formatting**: Line breaks around `&&` expressions can create problematic whitespace
- **Testing approach**: Isolating components in dedicated test routes helps identify exact issues
- **Not fragments**: The issue was NOT caused by React fragments (`<>` and `</>`) as initially suspected

## Prevention
To avoid similar issues in the future:
1. Keep conditional JSX expressions on single lines where possible
2. Be mindful of whitespace in React Native components
3. Use dedicated test routes for debugging complex rendering issues
4. Remember that React Native is stricter about text nodes than React DOM

## Files Modified
- `/packages/ui/src/events/progressive-event-form.tsx` - Applied the fix
- `/apps/next/app/debug/text-node-test/page.tsx` - Created test route for verification

## Test Route
Visit `http://localhost:4000/debug/text-node-test` to see the isolated component working correctly.