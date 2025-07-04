import Link from 'next/link'

export default function NotFound() {
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
        <div style={{ fontSize: '48px' }}>🔍</div>
        
        <div>
          <h1 style={{ 
            margin: '0 0 8px 0', 
            fontSize: '24px', 
            fontWeight: 'bold',
            color: '#111827'
          }}>
            Page Not Found
          </h1>
          
          <p style={{ 
            margin: '0', 
            fontSize: '16px',
            color: '#6B7280',
            lineHeight: '1.5'
          }}>
            The page you're looking for doesn't exist or may have been moved.
          </p>
        </div>

        <Link
          href="/"
          style={{
            backgroundColor: '#3B4CB8',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: '600',
            fontSize: '14px'
          }}
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}