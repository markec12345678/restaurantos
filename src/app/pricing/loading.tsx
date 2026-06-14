export default function Loading() {
  return (
    <div style={{ padding: 40, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: '#6b7280', fontSize: 14 }}>Nalaganje...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}
