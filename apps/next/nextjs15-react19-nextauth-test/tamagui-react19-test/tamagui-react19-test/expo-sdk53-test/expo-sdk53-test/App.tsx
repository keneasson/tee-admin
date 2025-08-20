import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'
import { useState } from 'react'

export default function App() {
  const [count, setCount] = useState(0)

  return (
    <View style={styles.container}>
      <Text style={styles.title}>✅ Expo SDK 53 + React 19 Test</Text>
      <Text style={styles.subtitle}>New Architecture Enabled</Text>

      <View style={styles.infoContainer}>
        <Text style={styles.info}>Expo: 53.0.13</Text>
        <Text style={styles.info}>React: 19.0.0</Text>
        <Text style={styles.info}>React Native: 0.79.4</Text>
      </View>

      <View style={styles.testContainer}>
        <Text style={styles.testText}>React Hooks Test: {count}</Text>
        <Text style={styles.button} onPress={() => setCount((c) => c + 1)}>
          Tap to increment
        </Text>
      </View>

      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  infoContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  info: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  testContainer: {
    alignItems: 'center',
  },
  testText: {
    fontSize: 18,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#1976d2',
    color: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    fontSize: 16,
  },
})
