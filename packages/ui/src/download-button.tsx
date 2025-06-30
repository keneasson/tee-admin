import React from 'react'
import { Paragraph, Text, View, XStack } from 'tamagui'
import { Link } from 'solito/link'
import { Download } from '@tamagui/lucide-icons/icons/Download'

type DownloadLinkProps = {
  children: React.ReactNode
  href: string
}

export const DownloadButton: React.FC<DownloadLinkProps> = ({ children, href }) => {
  return (
    <Paragraph>
      <View
        borderColor={'$blue11Light'}
        borderWidth={1}
        borderRadius={10}
        flexDirection={'column'}
        display="inline-flex"
        marginVertical={4}
        backgroundColor={'$blue5Light'}
      >
        <Link href={href} download target={'_blank'} rel="noopener noreferrer">
          <XStack paddingHorizontal={6} display="inline-flex" gap={8}>
            <Download />
            <Text fontSize={'$3'}>{children}</Text>
          </XStack>
        </Link>
      </View>
    </Paragraph>
  )
}
