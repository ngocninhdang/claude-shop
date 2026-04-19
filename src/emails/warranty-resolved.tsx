import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

type Props = {
  orderCode: string
  productName: string
  newCredential: string
}

export default function WarrantyResolvedEmail({ orderCode, productName, newCredential }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Bảo hành đã xử lý — đơn {orderCode}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.h1}>Đã xử lý bảo hành</Heading>
          <Text style={styles.p}>
            Đơn <b>{orderCode}</b> — sản phẩm <b>{productName}</b> đã được đổi sang tài khoản mới.
          </Text>
          <div style={styles.box}>
            <Text style={styles.label}>Credential mới</Text>
            <Text style={styles.credential}>{newCredential}</Text>
          </div>
          <Text style={styles.small}>
            Vẫn áp dụng thời hạn bảo hành của đơn gốc. Liên hệ lại nếu còn vấn đề.
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
  p: { fontSize: 16, lineHeight: 1.6, color: '#4d4c48' },
  box: {
    background: '#faf9f5',
    border: '1px solid #e8e6dc',
    borderRadius: 8,
    padding: 16,
    margin: '16px 0',
  },
  label: { fontSize: 14, color: '#87867f', margin: '0 0 6px' },
  credential: { fontFamily: 'monospace', fontSize: 15, color: '#141413', wordBreak: 'break-all' as const },
  small: { fontSize: 13, color: '#87867f' },
} as const
