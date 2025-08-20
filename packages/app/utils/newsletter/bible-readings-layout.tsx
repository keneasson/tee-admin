import React from 'react'
import { DailyReading } from '@my/app/types/newsletter-rules'

/**
 * Bible Readings Email Layout Components
 * Creates responsive table layout for 7-day reading schedule
 */

interface BibleReadingsEmailProps {
  readings: DailyReading[]
  weekRange?: string
  title?: string
}

/**
 * React Email component for Bible readings table
 */
export const BibleReadingsEmail: React.FC<BibleReadingsEmailProps> = ({ 
  readings, 
  weekRange,
  title = "Daily Bible Readings"
}) => {
  if (!readings || readings.length === 0) {
    return (
      <div style={containerStyle}>
        <h3 style={titleStyle}>{title}</h3>
        <p style={noDataStyle}>Readings schedule temporarily unavailable</p>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <h3 style={titleStyle}>
        {title}
        {weekRange && <span style={weekRangeStyle}> - {weekRange}</span>}
      </h3>
      
      {/* Desktop Table Layout */}
      <table style={tableStyle} className="readings-table">
        <thead>
          <tr style={headerRowStyle}>
            <th style={headerCellStyle}>Day</th>
            <th style={headerCellStyle}>Reading 1</th>
            <th style={headerCellStyle}>Reading 2</th>
            <th style={headerCellStyle}>Reading 3</th>
          </tr>
        </thead>
        <tbody>
          {readings.map((reading, index) => (
            <tr key={index} style={dataRowStyle}>
              <td style={dateCellStyle} data-label="Day">
                <strong>{formatReadingDate(reading.date)}</strong>
              </td>
              <td style={readingCellStyle} data-label="Reading 1">
                {reading.reading1}
              </td>
              <td style={readingCellStyle} data-label="Reading 2">
                {reading.reading2}
              </td>
              <td style={readingCellStyle} data-label="Reading 3">
                {reading.reading3}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile Stack Layout (CSS will show this on narrow screens) */}
      <div style={mobileStackStyle} className="readings-mobile">
        {readings.map((reading, index) => (
          <div key={index} style={mobileCardStyle}>
            <div style={mobileDateStyle}>
              <strong>{formatReadingDate(reading.date)}</strong>
            </div>
            <div style={mobileReadingsStyle}>
              <div style={mobileReadingItemStyle}>
                <span style={mobileLabelStyle}>Reading 1:</span> {reading.reading1}
              </div>
              <div style={mobileReadingItemStyle}>
                <span style={mobileLabelStyle}>Reading 2:</span> {reading.reading2}
              </div>
              <div style={mobileReadingItemStyle}>
                <span style={mobileLabelStyle}>Reading 3:</span> {reading.reading3}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Web version for newsletter page (slightly different styling)
 */
export const BibleReadingsWeb: React.FC<BibleReadingsEmailProps> = ({ 
  readings, 
  weekRange,
  title = "Daily Bible Readings"
}) => {
  if (!readings || readings.length === 0) {
    return (
      <div style={webContainerStyle}>
        <h3 style={webTitleStyle}>{title}</h3>
        <p style={noDataStyle}>Readings schedule temporarily unavailable</p>
      </div>
    )
  }

  return (
    <div style={webContainerStyle}>
      <h3 style={webTitleStyle}>
        {title}
        {weekRange && <span style={weekRangeStyle}> - {weekRange}</span>}
      </h3>
      
      <div style={webTableWrapperStyle}>
        <table style={webTableStyle}>
          <thead>
            <tr style={webHeaderRowStyle}>
              <th style={webHeaderCellStyle}>Day</th>
              <th style={webHeaderCellStyle}>Reading 1</th>
              <th style={webHeaderCellStyle}>Reading 2</th>
              <th style={webHeaderCellStyle}>Reading 3</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((reading, index) => (
              <tr key={index} style={webDataRowStyle}>
                <td style={webDateCellStyle}>
                  <strong>{formatReadingDate(reading.date)}</strong>
                </td>
                <td style={webReadingCellStyle}>{reading.reading1}</td>
                <td style={webReadingCellStyle}>{reading.reading2}</td>
                <td style={webReadingCellStyle}>{reading.reading3}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Format date for readings display (with null safety)
 */
function formatReadingDate(date: Date | string | undefined | null): string {
  if (!date) {
    return 'Date unavailable'
  }

  // Ensure date is a Date object
  const dateObj = date instanceof Date ? date : new Date(date)
  
  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    return 'Invalid date'
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  
  const dayName = dayNames[dateObj.getDay()]
  const monthName = monthNames[dateObj.getMonth()]
  const day = dateObj.getDate()
  
  return `${dayName}, ${monthName} ${day}`
}

/**
 * Generate week range string
 */
export function generateWeekRange(readings: DailyReading[]): string {
  if (!readings || readings.length === 0) return ''
  
  // Safely get first and last dates with null checks
  const firstReading = readings[0]
  const lastReading = readings[readings.length - 1]
  
  if (!firstReading?.date || !lastReading?.date) {
    return 'Date range unavailable'
  }
  
  // Ensure dates are Date objects, not strings
  const firstDate = firstReading.date instanceof Date ? firstReading.date : new Date(firstReading.date)
  const lastDate = lastReading.date instanceof Date ? lastReading.date : new Date(lastReading.date)
  
  // Check if dates are valid
  if (isNaN(firstDate.getTime()) || isNaN(lastDate.getTime())) {
    return 'Invalid date range'
  }
  
  const formatDateRange = (date: Date) => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${monthNames[date.getMonth()]} ${date.getDate()}`
  }
  
  const firstYear = firstDate.getFullYear()
  const lastYear = lastDate.getFullYear()
  
  if (firstYear === lastYear) {
    return `${formatDateRange(firstDate)} - ${formatDateRange(lastDate)}, ${firstYear}`
  } else {
    return `${formatDateRange(firstDate)}, ${firstYear} - ${formatDateRange(lastDate)}, ${lastYear}`
  }
}

// Email Styles (inline for maximum compatibility)
const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '600px',
  margin: '20px auto',
  fontFamily: 'Arial, sans-serif',
  fontSize: '14px',
  lineHeight: '1.4'
}

const titleStyle: React.CSSProperties = {
  color: '#333333',
  fontSize: '18px',
  fontWeight: 'bold',
  marginBottom: '12px',
  textAlign: 'center'
}

const weekRangeStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 'normal',
  color: '#666666'
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginBottom: '20px',
  backgroundColor: '#ffffff'
}

const headerRowStyle: React.CSSProperties = {
  backgroundColor: '#f8f9fa'
}

const headerCellStyle: React.CSSProperties = {
  padding: '10px 8px',
  border: '1px solid #dee2e6',
  textAlign: 'left',
  fontWeight: 'bold',
  fontSize: '13px',
  color: '#495057'
}

const dataRowStyle: React.CSSProperties = {
  borderBottom: '1px solid #dee2e6'
}

const dateCellStyle: React.CSSProperties = {
  padding: '10px 8px',
  border: '1px solid #dee2e6',
  verticalAlign: 'top',
  minWidth: '90px',
  fontSize: '13px'
}

const readingCellStyle: React.CSSProperties = {
  padding: '10px 8px',
  border: '1px solid #dee2e6',
  verticalAlign: 'top',
  fontSize: '13px'
}

const noDataStyle: React.CSSProperties = {
  textAlign: 'center',
  color: '#6c757d',
  fontStyle: 'italic',
  padding: '20px'
}

// Mobile stack layout (hidden by default, shown via CSS media queries)
const mobileStackStyle: React.CSSProperties = {
  display: 'none' // Will be shown via CSS media query
}

const mobileCardStyle: React.CSSProperties = {
  backgroundColor: '#f8f9fa',
  border: '1px solid #dee2e6',
  borderRadius: '4px',
  marginBottom: '10px',
  padding: '12px'
}

const mobileDateStyle: React.CSSProperties = {
  fontSize: '14px',
  marginBottom: '8px',
  color: '#495057'
}

const mobileReadingsStyle: React.CSSProperties = {
  fontSize: '13px'
}

const mobileReadingItemStyle: React.CSSProperties = {
  marginBottom: '4px'
}

const mobileLabelStyle: React.CSSProperties = {
  fontWeight: 'bold',
  color: '#495057'
}

// Web Styles (for newsletter page)
const webContainerStyle: React.CSSProperties = {
  width: '100%',
  margin: '20px 0'
}

const webTitleStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 'bold',
  marginBottom: '16px',
  color: '#212529'
}

const webTableWrapperStyle: React.CSSProperties = {
  overflowX: 'auto',
  backgroundColor: '#ffffff',
  borderRadius: '6px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
}

const webTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse'
}

const webHeaderRowStyle: React.CSSProperties = {
  backgroundColor: '#f8f9fa'
}

const webHeaderCellStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '2px solid #dee2e6',
  textAlign: 'left',
  fontWeight: '600',
  fontSize: '14px',
  color: '#495057'
}

const webDataRowStyle: React.CSSProperties = {
  borderBottom: '1px solid #dee2e6'
}

const webDateCellStyle: React.CSSProperties = {
  padding: '12px 16px',
  verticalAlign: 'top',
  minWidth: '120px',
  fontSize: '14px',
  backgroundColor: '#f8f9fa'
}

const webReadingCellStyle: React.CSSProperties = {
  padding: '12px 16px',
  verticalAlign: 'top',
  fontSize: '14px'
}

/**
 * CSS for email client compatibility
 */
export const bibleReadingsEmailCSS = `
/* Email Client Responsive Styles */
@media only screen and (max-width: 600px) {
  .readings-table {
    display: none !important;
  }
  
  .readings-mobile {
    display: block !important;
  }
  
  /* Stack table rows on mobile */
  .readings-table tr,
  .readings-table td {
    display: block !important;
    width: 100% !important;
    border: none !important;
  }
  
  .readings-table td:before {
    content: attr(data-label) ": ";
    font-weight: bold;
    color: #495057;
  }
  
  .readings-table td {
    padding: 8px 12px !important;
    text-align: left !important;
    border-bottom: 1px solid #dee2e6 !important;
  }
  
  .readings-table thead {
    display: none !important;
  }
  
  .readings-table tbody tr {
    background-color: #f8f9fa !important;
    margin-bottom: 8px !important;
    border-radius: 4px !important;
  }
}

/* Outlook-specific fixes */
@media screen and (max-width: 600px) {
  .readings-table {
    width: 100% !important;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .readings-table {
    background-color: #1a1a1a !important;
    color: #ffffff !important;
  }
  
  .readings-table th,
  .readings-table td {
    border-color: #444444 !important;
  }
  
  .readings-table thead tr {
    background-color: #2d2d2d !important;
  }
}
`

/**
 * Plain text version for email clients that don't support HTML
 */
export function generatePlainTextReadings(readings: DailyReading[], title: string = 'Daily Bible Readings'): string {
  if (!readings || readings.length === 0) {
    return `${title}\n\nReadings schedule temporarily unavailable`
  }

  const weekRange = generateWeekRange(readings)
  let text = `${title}`
  if (weekRange) {
    text += ` - ${weekRange}`
  }
  text += '\n\n'

  readings.forEach(reading => {
    const dateStr = formatReadingDate(reading.date)
    text += `${dateStr}\n`
    text += `  Reading 1: ${reading.reading1}\n`
    text += `  Reading 2: ${reading.reading2}\n`
    text += `  Reading 3: ${reading.reading3}\n\n`
  })

  return text.trim()
}