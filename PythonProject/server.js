require('dotenv').config();  // 加载 .env 文件中的环境变量
const express = require('express');
const Stripe = require('stripe');
const paypal = require('@paypal/checkout-server-sdk');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();

// 使用 .env 文件中的 Stripe 密钥
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// 设置 PayPal 配置（真实环境）
let environment = new paypal.core.LiveEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_SECRET);
let paypalClient = new paypal.core.PayPalHttpClient(environment);

// 提供静态文件（如 index.html 和 payment.html）
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());  // 解析 JSON 请求体

// 路由：首页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 路由：支付页面
app.get('/payment', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment.html'));
});

// 路由：创建 Stripe 支付
app.post('/create-stripe-charge', async (req, res) => {
  const { token, amount } = req.body;

  try {
    // 通过 Stripe 进行收费
    const charge = await stripe.charges.create({
      amount: amount,  // Amount in cents
      currency: 'usd',
      description: 'Sample Product',
      source: token,
    });

    // 一旦支付成功，转账到 PayPal
    const transfer = await transferToPaypal(amount / 100);  // 转换为美元
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 支付到 PayPal（真实转账）
async function transferToPaypal(amount) {
  const request = new paypal.payouts.PayoutsPostRequest();
  request.requestBody({
    sender_batch_header: {
      sender_batch_id: `batch_${Date.now()}`,  // 唯一批次 ID
      email_subject: 'You have a payment',
    },
    items: [
      {
        recipient_type: 'EMAIL',
        amount: {
          value: amount.toFixed(2),  // 金额保留两位小数
          currency: 'USD',
        },
        note: 'Payment transfer',
        receiver: 'recipient-email@example.com',  // 替换为接收方的真实 PayPal 邮箱
      },
    ],
  });

  try {
    const payout = await paypalClient.execute(request);
    return payout;
  } catch (err) {
    console.error(err);
    throw new Error('PayPal transfer failed');
  }
}


app.post('/create-stripe-charge', async (req, res) => {
  const { paymentMethodId, amount } = req.body;

  try {
    // 创建支付意图
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,  // 金额以美分为单位
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,  // 立即确认支付
    });

    // 如果支付成功，转账到 PayPal
    const transfer = await transferToPaypal(amount / 100);  // 转换为美元
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/create-stripe-charge', async (req, res) => {
  console.log('Received payment request:', req.body);  // 打印请求体

  const { paymentMethodId, amount } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
    });

    console.log('PaymentIntent created:', paymentIntent);  // 打印支付意图

    const transfer = await transferToPaypal(amount / 100);
    res.json({ success: true });
  } catch (err) {
    console.error('Server error:', err);  // 打印服务器错误
    res.status(500).json({ success: false, error: err.message });
  }
});

// 启动服务器
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));