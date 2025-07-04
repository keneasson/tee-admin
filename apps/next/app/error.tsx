'use client'

import React from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  React.useEffect(() => {
    // Log the error to console for debugging
    console.error('Application error:', error)
  }, [error])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#FFFFFF',
        padding: '16px'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          padding: '32px',
          backgroundColor: '#F9FAFB',
          borderRadius: '8px',
          border: '1px solid #E5E7EB',
          maxWidth: '500px',
          textAlign: 'center'
        }}
      >
        <div style={{ fontSize: '48px' }}>⚠️</div>
        
        <div>
          <h1 style={{ 
            margin: '0 0 8px 0', 
            fontSize: '24px', 
            fontWeight: 'bold',
            color: '#111827'
          }}>
            Something went wrong
          </h1>
          
          <p style={{ 
            margin: '0', 
            fontSize: '16px',
            color: '#6B7280',
            lineHeight: '1.5'
          }}>
            An unexpected error occurred. You can try refreshing the page or contact support if the problem persists.
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div
            style={{
              backgroundColor: '#F3F4F6',
              padding: '12px',
              borderRadius: '4px',
              border: '1px solid #D1D5DB',
              width: '100%',
              fontFamily: 'monospace',
              fontSize: '12px',
              color: '#6B7280',
              textAlign: 'left',
              overflow: 'auto'
            }}
          >
            {error.message}
            {error.digest && (
              <div style={{ marginTop: '4px', fontSize: '10px', color: '#9CA3AF' }}>
                Error ID: {error.digest}
              </div>
            )}
          </div>
        )}

        <button
          onClick={reset}
          style={{
            backgroundColor: '#3B4CB8',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}