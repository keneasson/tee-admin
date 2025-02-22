import { colours } from './tokens'

export const globalCss = `
@media only screen and (max-width: 648px)  {
  .container {
    padding: 6px;
  }
  .deviceWidth {
    width: 280px!important;
  }
}
`

export const container = {
  margin: '0 auto',
  width: '648px',
  maxWidth: '100%',
  position: 'relative' as const,
}

export const columnAlignTop = {
  display: 'table-cell',
  verticalAlign: 'top',
}

export const footer = {
  background: colours['background-bright'],
  color: colours['foreground-bright'],
  textAlign: 'center' as const,
  padding: '12px 24px 48px',
  marginBottom: '0',
  boxShadow: `0 50vh 0 50vh ${colours['background-bright']}`,
}

export const footerText = {
  fontSize: '13px',
}

export const footerLink = {
  textDecoration: 'underline',
  color: colours['foreground-action'],
  cursor: 'pointer',
}

export const heading = {
  background: colours['background-bright'],
  padding: '30px',
  color: colours['background-dark'],
  fontWeight: '400',
  marginBottom: '0',
}

export const header = {
  backgroundColor: '#c5d9fd',
  textAlign: 'center' as const,
  paddingBottom: '10px',
}

export const info = {
  color: '#000821',
}

export const link = {
  color: '#003da9',
  cursor: 'pointer',
  padding: '5px 5px 3px',
  border: '2px solid #003da9',
  borderRadius: '6px',
  backgroundColor: '#fefeff',
}

export const main = {
  fontFamily: '"Google Sans",Roboto,RobotoDraft,Helvetica,Arial,sans-serif',
  backgroundColor: '#fdfaf5',
  color: '#00102c',
  margin: '0',
}

export const program = {
  color: '#000821',
}

export const specialNoteContainer = {
  border: '2px solid #bc6401',
  backgroundColor: 'white',
  margin: '0px',
}

export const specialNotice = {
  margin: '12px',
  width: 'calc(100% - 24px)',
  color: '#e08712',
}

export const notice = {
  backgroundColor: '#ff3333',
  color: 'white',
  padding: '3px',
}

export const weatherNotice = {
  backgroundColor: '#ff3333',
  color: 'white',
  padding: '3px',
  textAlign: 'center' as const,
}

export const weatherNoticeText = {
  fontSize: '24px',
  lineHeight: '34px',
  backgroundColor: '#ff3333',
  color: 'white',
  margin: '24px',
}

export const defaultText = {
  fontSize: '16px',
}
