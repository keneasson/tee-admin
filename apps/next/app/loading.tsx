'use client'

export default function Loading() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#FFFFFF',
        gap: '16px'
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          border: '3px solid #E5E7EB',
          borderTop: '3px solid #3B4CB8',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}
      />
      
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ 
          margin: '0 0 8px 0', 
          fontSize: '20px', 
          fontWeight: '600',
          color: '#111827'
        }}>
          Loading...
        </h2>
        
        <p style={{ 
          margin: '0', 
          fontSize: '14px',
          color: '#6B7280'
        }}>
          Please wait while we load the page
        </p>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}