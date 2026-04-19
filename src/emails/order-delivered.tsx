import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

type Props = {
  orderCode: string
  items: { productName: string; credential: string }[]
}

export default function OrderDeliveredEmail({ orderCode, items }: Props) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return (
    <Html>
      <Head />
      <Preview>Đơn {orderCode} đã giao — credential ở bên trong</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.h1}>Đơn {orderCode} đã được giao</Heading>
          <Text style={styles.p}>
            Cảm ơn bạn. Thông tin tài khoản được liệt kê dưới đây. Vui lòng lưu lại cẩn thận.
          </Text>
          <Section>
            {items.map((it, i) => (
              <div key={i} style={styles.itemBox}>
                <Text style={styles.itemName}>{it.productName}</Text>
                <Text style={styles.credential}>{it.credential}</Text>
              </div>
            ))}
          </Section>
          <Hr style={styles.hr} />
          <Text style={styles.p}>
            Xem lại đơn:{' '}
            <Link href={`${siteUrl}/orders/${orderCode}`} style={styles.link}>
              {siteUrl}/orders/{orderCode}
            </Link>
          </Text>
          <Text style={styles.small}>
            Nếu sản phẩm có bảo hành và bạn gặp sự cố, hãy vào trang đơn hàng và bấm "Yêu cầu bảo hành".
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const styles = {
  body: { backgroundColor: '#f5f4ed', fontFamily: 'Georgia, serif', margin: 0, padding: 0 },
  container: { maxWidth: 560, margin: '0 auto', padding: 32 },
  h1: { fontSize: 28, color: '#141413', margin: '0 0 16px' },
  p: { fontSize: 16, lineHeight: 1.6, color: '#4d4c48', margin: '0 0 12px' },
  small: { fontSize: 13, color: '#87867f', margin: '12px 0 0' },
  itemBox: {
    background: '#faf9f5',
    border: '1px solid #e8e6dc',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  itemName: { fontSize: 14, color: '#87867f', margin: '0 0 6px' },
  credential: {
    fontFamily: 'monospace',
    fontSize: 15,
    color: '#141413',
    margin: 0,
    wordBreak: 'break-all' as const,
  },
  hr: { borderColor: '#e8e6dc', margin: '24px 0' },
  link: { color: '#c96442', textDecoration: 'underline' },
} as const
