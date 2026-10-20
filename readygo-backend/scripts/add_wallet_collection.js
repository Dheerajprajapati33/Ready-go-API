import fs from 'fs';
import path from 'path';

const collectionPath = path.resolve('readygo-backend/readygo_collection.json');
const raw = fs.readFileSync(collectionPath, 'utf8');
const collection = JSON.parse(raw);

const driverPage = collection.item.find(i => i.name === 'DriverPage');
if (!driverPage) {
  console.error('DriverPage not found in collection');
  process.exit(1);
}

// Check if already exists
const existing = driverPage.item.find(i => i.name === 'driver wallet & payouts' || i.name === '18. Driver Wallet and Payouts');
if (existing) {
  console.log('Driver wallet & payouts already exists in DriverPage');
  process.exit(0);
}

const walletFolder = {
  name: "driver wallet & payouts",
  description: "Section 18: Driver Wallet, Ledger Transactions, Saved Payout Accounts (UPI/Bank) and Instant/Standard Withdrawal Requests",
  item: [
    {
      name: "getdriverwallet",
      request: {
        method: "GET",
        header: [
          { key: "Authorization", value: "Bearer {{driverToken}}" }
        ],
        url: {
          raw: "{{baseUrl}}/driver/wallet",
          host: ["{{baseUrl}}"],
          path: ["driver", "wallet"]
        },
        description: "▶️ **[STEP 6.1: GET DRIVER WALLET BALANCE - WORK START]**\n- **Purpose:** Available balance, currency aur last credited transaction detail fetch karta hai."
      }
    },
    {
      name: "getwallettransactions",
      request: {
        method: "GET",
        header: [
          { key: "Authorization", value: "Bearer {{driverToken}}" }
        ],
        url: {
          raw: "{{baseUrl}}/driver/wallet/transactions?page=1&limit=10",
          host: ["{{baseUrl}}"],
          path: ["driver", "wallet", "transactions"],
          query: [
            { key: "page", value: "1" },
            { key: "limit", value: "10" }
          ]
        },
        description: "▶️ **[STEP 6.2: GET WALLET LEDGER TRANSACTIONS]**\n- **Purpose:** Paginated credits aur debits: trip payouts, surge bonuses, incentives aur withdrawals history deta hai."
      }
    },
    {
      name: "getpayoutaccounts",
      request: {
        method: "GET",
        header: [
          { key: "Authorization", value: "Bearer {{driverToken}}" }
        ],
        url: {
          raw: "{{baseUrl}}/driver/payout-accounts",
          host: ["{{baseUrl}}"],
          path: ["driver", "payout-accounts"]
        },
        description: "▶️ **[STEP 6.3: LIST SAVED PAYOUT ACCOUNTS]**\n- **Purpose:** Driver ke saved UPI / Bank destinations with masked sensitive values (e.g. `********8231`, `dr***@okaxis`) return karta hai."
      }
    },
    {
      name: "addupipayoutaccount",
      event: [
        {
          listen: "test",
          script: {
            exec: [
              "var jsonData = pm.response.json();",
              "if (jsonData.success && jsonData.data && (jsonData.data.destinationId || jsonData.data.id)) {",
              "    var destId = jsonData.data.destinationId || jsonData.data.id;",
              "    pm.environment.set('destinationId', destId);",
              "    console.log('[AUTO-SAVED] destinationId:', destId);",
              "}"
            ],
            type: "text/javascript"
          }
        }
      ],
      request: {
        method: "POST",
        header: [
          { key: "Authorization", value: "Bearer {{driverToken}}" },
          { key: "Content-Type", value: "application/json" }
        ],
        body: {
          mode: "raw",
          raw: JSON.stringify({
            upiId: "driver@okaxis",
            accountType: "UPI"
          }, null, 2)
        },
        url: {
          raw: "{{baseUrl}}/driver/payout-accounts/upi",
          host: ["{{baseUrl}}"],
          path: ["driver", "payout-accounts", "upi"]
        },
        description: "▶️ **[STEP 6.4: SAVE UPI PAYOUT DESTINATION]**\n- **Purpose:** Driver ka UPI VPA address save karta hai aur pending verification create karta hai."
      }
    },
    {
      name: "addbankpayoutaccount",
      event: [
        {
          listen: "test",
          script: {
            exec: [
              "var jsonData = pm.response.json();",
              "if (jsonData.success && jsonData.data && (jsonData.data.destinationId || jsonData.data.id)) {",
              "    var destId = jsonData.data.destinationId || jsonData.data.id;",
              "    pm.environment.set('destinationId', destId);",
              "    console.log('[AUTO-SAVED] destinationId:', destId);",
              "}"
            ],
            type: "text/javascript"
          }
        }
      ],
      request: {
        method: "POST",
        header: [
          { key: "Authorization", value: "Bearer {{driverToken}}" },
          { key: "Content-Type", value: "application/json" }
        ],
        body: {
          mode: "raw",
          raw: JSON.stringify({
            accountHolderName: "Rajesh Kumar",
            accountNumber: "50100234918231",
            ifscCode: "HDFC0001234",
            accountType: "BANK"
          }, null, 2)
        },
        url: {
          raw: "{{baseUrl}}/driver/payout-accounts/bank",
          host: ["{{baseUrl}}"],
          path: ["driver", "payout-accounts", "bank"]
        },
        description: "▶️ **[STEP 6.5: SAVE BANK ACCOUNT DESTINATION]**\n- **Purpose:** Bank account holder name, account number aur IFSC code securely save karta hai."
      }
    },
    {
      name: "verifypayoutdestination",
      request: {
        method: "POST",
        header: [
          { key: "Authorization", value: "Bearer {{driverToken}}" },
          { key: "Content-Type", value: "application/json" }
        ],
        body: {
          mode: "raw",
          raw: JSON.stringify({
            verificationMethod: "PROVIDER"
          }, null, 2)
        },
        url: {
          raw: "{{baseUrl}}/driver/payout-accounts/{{destinationId}}/verify",
          host: ["{{baseUrl}}"],
          path: ["driver", "payout-accounts", "{{destinationId}}", "verify"]
        },
        description: "▶️ **[STEP 6.6: VERIFY PAYOUT DESTINATION]**\n- **Purpose:** Payout destination ko verify karta hai taki driver withdrawal kar sake."
      }
    },
    {
      name: "requestpayout",
      event: [
        {
          listen: "test",
          script: {
            exec: [
              "var jsonData = pm.response.json();",
              "if (jsonData.success && jsonData.data && (jsonData.data.payoutId || jsonData.data.id)) {",
              "    var pId = jsonData.data.payoutId || jsonData.data.id;",
              "    pm.environment.set('payoutId', pId);",
              "    console.log('[AUTO-SAVED] payoutId:', pId);",
              "}"
            ],
            type: "text/javascript"
          }
        }
      ],
      request: {
        method: "POST",
        header: [
          { key: "Authorization", value: "Bearer {{driverToken}}" },
          { key: "Content-Type", value: "application/json" },
          { key: "Idempotency-Key", value: "payout_req_{{$timestamp}}" }
        ],
        body: {
          mode: "raw",
          raw: JSON.stringify({
            amountPaise: 200000,
            destinationId: "{{destinationId}}",
            mode: "INSTANT"
          }, null, 2)
        },
        url: {
          raw: "{{baseUrl}}/driver/payouts",
          host: ["{{baseUrl}}"],
          path: ["driver", "payouts"]
        },
        description: "▶️ **[STEP 6.7: REQUEST INSTANT/STANDARD PAYOUT]**\n- **Purpose:** Verified bank account ya UPI me paise withdraw karne ki request raise karta hai with atomic balance debit."
      }
    },
    {
      name: "listdriverpayouts",
      request: {
        method: "GET",
        header: [
          { key: "Authorization", value: "Bearer {{driverToken}}" }
        ],
        url: {
          raw: "{{baseUrl}}/driver/payouts?page=1&limit=10",
          host: ["{{baseUrl}}"],
          path: ["driver", "payouts"],
          query: [
            { key: "page", value: "1" },
            { key: "limit", value: "10" }
          ]
        },
        description: "▶️ **[STEP 6.8: LIST PAYOUT REQUESTS]**\n- **Purpose:** Driver dwara kiye gaye sabhi withdrawal requests aur unke status (`REQUESTED`, `PROCESSING`, `PAID`) ki list deta hai."
      }
    },
    {
      name: "getpayoutstatus",
      request: {
        method: "GET",
        header: [
          { key: "Authorization", value: "Bearer {{driverToken}}" }
        ],
        url: {
          raw: "{{baseUrl}}/driver/payouts/{{payoutId}}",
          host: ["{{baseUrl}}"],
          path: ["driver", "payouts", "{{payoutId}}"]
        },
        description: "⏹️ **[STEP 6.9: GET SINGLE PAYOUT STATUS - WORK END]**\n- **Purpose:** Kisi specific withdrawal request ka live processing status check karta hai."
      }
    }
  ]
};

driverPage.item.push(walletFolder);

fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2), 'utf8');
console.log('Successfully added "driver wallet & payouts" to DriverPage in readygo_collection.json');
