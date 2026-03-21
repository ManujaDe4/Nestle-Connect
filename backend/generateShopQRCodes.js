const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

const shops = [
  {
    shop_id: "SHOP001",
    shop_name: "Nugegoda Local Shop",
    qr_slug: "nugegoda-local-shop",
  },
  {
    shop_id: "SHOP002",
    shop_name: "Kandy Corner Store",
    qr_slug: "kandy-corner-store",
  },
  {
    shop_id: "SHOP003",
    shop_name: "Maharagama Mini Mart",
    qr_slug: "maharagama-mini-mart",
  },
];

const outputDir = path.join(__dirname, "../frontend/assets/images/qrcodes");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateQRCodes() {
  try {
    for (const shop of shops) {
      const shopUrl = `https://nestle-connect.onrender.com/store-verify.html?shop=${shop.qr_slug}`;
      const outputFile = path.join(outputDir, `${shop.shop_id}.png`);

      await QRCode.toFile(outputFile, shopUrl, {
        width: 300,
        margin: 2,
      });

      console.log(`QR generated for ${shop.shop_name}: ${outputFile}`);
    }

    console.log("All QR codes generated successfully.");
  } catch (error) {
    console.error("Error generating QR codes:", error);
  }
}

generateQRCodes();