'use client'

import React, { useState, useEffect } from 'react'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'

interface NewsletterPreview {
  assembly: any
  metadata: {
    generatedAt: string
    newsletterDate: string
    status: string
    completenessScore: number
    readyToSend: boolean
    contentSummary: {
      totalEvents: number
      hasRegularServices: boolean
      hasReadings: boolean
      hasStandingContent: boolean
      estimatedWordCount: number
    }
    validationSummary: {
      errorCount: number
      warningCount: number
      criticalIssues: string[]
    }
  }
  formats: {
    email?: {
      html: string
      css: string
      plainText: string
      subject: string
      sections: Array<{
        id: string
        title: string
        type: string
        priority: number
        wordCount: number
      }>
      estimatedLength: { characters: number, estimatedKB: number }
      deliverabilityScore: number
    }
    web?: {
      html: string
      css: string
      sections: any[]
      estimatedReadingTime: number
      seoScore: number
    }
    plain?: {
      content: string
      wordCount: number
      characterCount: number
    }
  }
}

export default function NewsletterPreviewPage() {
  const isHydrated = useHydrated()
  const [preview, setPreview] = useState<NewsletterPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [previewFormat, setPreviewFormat] = useState<'email' | 'web' | 'plain'>('email')

  useEffect(() => {
    // Set default date to next Thursday
    const nextThursday = getNextThursday(new Date())
    setSelectedDate(nextThursday.toISOString().split('T')[0])
  }, [])

  const generatePreview = async () => {
    if (!selectedDate) return

    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/newsletter/assemble?date=${selectedDate}&format=both`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      setPreview(data.preview)
    } catch (err) {
      console.error('Failed to generate newsletter preview:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate preview')
    } finally {
      setLoading(false)
    }
  }

  function getNextThursday(date: Date): Date {
    const result = new Date(date)
    const dayOfWeek = result.getDay()
    const daysUntilThursday = (4 - dayOfWeek + 7) % 7 || 7 // 4 = Thursday
    result.setDate(result.getDate() + daysUntilThursday)
    return result
  }

  if (!isHydrated) {
    return <Loading />
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ color: '#333', marginBottom: '20px' }}>Newsletter Preview Generator</h1>
        
        {/* Controls */}
        <div style={{ 
          display: 'flex', 
          gap: '15px', 
          alignItems: 'center', 
          marginBottom: '20px',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <div>
            <label htmlFor="newsletter-date" style={{ marginRight: '8px', fontWeight: 'bold' }}>
              Newsletter Date:
            </label>
            <input
              id="newsletter-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          
          <button
            onClick={generatePreview}
            disabled={loading || !selectedDate}
            style={{
              padding: '10px 20px',
              backgroundColor: loading ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Generating...' : 'Generate Preview'}
          </button>
          
          {preview && (
            <div>
              <label htmlFor="preview-format" style={{ marginRight: '8px', fontWeight: 'bold' }}>
                View:
              </label>
              <select
                id="preview-format"
                value={previewFormat}
                onChange={(e) => setPreviewFormat(e.target.value as 'email' | 'web' | 'plain')}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="email">Email Version</option>
                <option value="web">Web Version</option>
                <option value="plain">Plain Text</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '15px',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          color: '#721c24',
          marginBottom: '20px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <div style={{ marginBottom: '10px' }}>🔄</div>
          <div>Generating newsletter preview...</div>
          <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
            This may take a few seconds while we gather data from all sources
          </div>
        </div>
      )}

      {/* Preview Results */}
      {preview && (
        <div>
          {/* Metadata Summary */}
          <div style={{
            marginBottom: '30px',
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <h2 style={{ marginTop: '0', marginBottom: '15px', color: '#333' }}>Assembly Summary</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#6c757d', textTransform: 'uppercase', marginBottom: '5px' }}>
                  Completeness Score
                </div>
                <div style={{ 
                  fontSize: '24px', 
                  fontWeight: 'bold', 
                  color: preview.metadata.completenessScore >= 90 ? '#28a745' : 
                         preview.metadata.completenessScore >= 75 ? '#ffc107' : '#dc3545'
                }}>
                  {preview.metadata.completenessScore}%
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: '12px', color: '#6c757d', textTransform: 'uppercase', marginBottom: '5px' }}>
                  Ready to Send
                </div>
                <div style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold', 
                  color: preview.metadata.readyToSend ? '#28a745' : '#dc3545'
                }}>
                  {preview.metadata.readyToSend ? '✅ Yes' : '❌ No'}
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: '12px', color: '#6c757d', textTransform: 'uppercase', marginBottom: '5px' }}>
                  Events Included
                </div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#495057' }}>
                  {preview.metadata.contentSummary.totalEvents}
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: '12px', color: '#6c757d', textTransform: 'uppercase', marginBottom: '5px' }}>
                  Issues
                </div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#495057' }}>
                  {preview.metadata.validationSummary.errorCount} errors, {preview.metadata.validationSummary.warningCount} warnings
                </div>
              </div>
            </div>
            
            {preview.metadata.validationSummary.criticalIssues.length > 0 && (
              <div style={{ marginTop: '15px' }}>
                <div style={{ fontSize: '12px', color: '#6c757d', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Critical Issues
                </div>
                <ul style={{ margin: '0', paddingLeft: '20px', color: '#dc3545' }}>
                  {preview.metadata.validationSummary.criticalIssues.map((issue, index) => (
                    <li key={index} style={{ marginBottom: '4px' }}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Preview Content */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '15px 20px',
              backgroundColor: '#f8f9fa',
              borderBottom: '1px solid #dee2e6',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: '0', color: '#333' }}>
                {previewFormat === 'email' ? 'Email Preview' :
                 previewFormat === 'web' ? 'Web Preview' : 'Plain Text Preview'}
              </h3>
              
              {previewFormat === 'email' && preview.formats.email && (
                <div style={{ fontSize: '12px', color: '#6c757d' }}>
                  Subject: {preview.formats.email.subject}
                </div>
              )}
            </div>
            
            <div style={{ padding: '20px' }}>
              {previewFormat === 'email' && preview.formats.email && (
                <div>
                  <style dangerouslySetInnerHTML={{ __html: preview.formats.email.css }} />
                  <div dangerouslySetInnerHTML={{ __html: preview.formats.email.html }} />
                </div>
              )}
              
              {previewFormat === 'web' && preview.formats.web && (
                <div>
                  <style dangerouslySetInnerHTML={{ __html: preview.formats.web.css }} />
                  <div dangerouslySetInnerHTML={{ __html: preview.formats.web.html }} />
                </div>
              )}
              
              {previewFormat === 'plain' && preview.formats.plain && (
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  color: '#495057',
                  margin: '0'
                }}>
                  {preview.formats.plain.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}