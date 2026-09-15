# Delhivery B2C shipping

SkinFox uses a server-only Delhivery adapter for pincode serviceability,
approximate shipping quotes, order manifestation, AWB tracking, pickup
requests, packing slips and cancellation. Existing orders and payment records
remain provider-agnostic in the database.

## Configuration

Copy the variables below to the API environment. Keep `manual` until the
Delhivery account and warehouse have been verified in staging.

```dotenv
SHIPPING_PROVIDER=manual
DELHIVERY_ENV=staging
DELHIVERY_API_TOKEN=
DELHIVERY_CLIENT_NAME=Exact registered client name
DELHIVERY_PICKUP_LOCATION=Exact registered warehouse name
DELHIVERY_PICKUP_PINCODE=400001
DELHIVERY_PICKUP_TIME=16:00:00
DELHIVERY_SELLER_NAME=
DELHIVERY_SELLER_ADDRESS=
DELHIVERY_SELLER_PINCODE=
DELHIVERY_SELLER_CITY=
DELHIVERY_SELLER_STATE=
DELHIVERY_SELLER_COUNTRY=India
DELHIVERY_SELLER_GST_TIN=
DELHIVERY_DEFAULT_HSN_CODE=
DELHIVERY_BILLING_MODE=E
DELHIVERY_WEBHOOK_TOKEN=
DELHIVERY_BOOKING_ENABLED=false
SHIPPING_DEFAULT_WEIGHT_KG=0.5
SHIPPING_DEFAULT_LENGTH_CM=
SHIPPING_DEFAULT_BREADTH_CM=
SHIPPING_DEFAULT_HEIGHT_CM=
```

`DELHIVERY_API_BASE_URL` can override the environment URL. Otherwise staging
uses `https://staging-express.delhivery.com` and production uses
`https://track.delhivery.com`. The client name and pickup location are
case-sensitive and must exactly match the Delhivery dashboard. GST TIN and HSN
are required for accounts that enforce seller tax fields; the API reports
missing values instead of silently inventing them.

Enable production in this order:

1. Verify the token, client, warehouse and pickup pincode with
   `/api/v1/admin/shipping/status` and the admin serviceability check.
2. Confirm the packed weight/dimensions and the approximate Delhivery rate in
   a test order. Rates are calculated by Delhivery and can vary at billing.
3. Configure the Delhivery webhook URL as
   `https://<api-host>/api/v1/shipping/webhook` and set the shared token if your
   account supports a custom webhook header.
4. Set `SHIPPING_PROVIDER=delhivery`, then enable
   `DELHIVERY_BOOKING_ENABLED=true` only after a successful staging shipment.

## Supported operations

- Pincode serviceability: Delhivery pin-code API, including COD capability.
- Rate calculation: Delhivery invoice/shipping-charge endpoint using dead or
  volumetric chargeable weight.
- Manifestation: Delhivery order creation allocates an AWB. There is no
  separate manifest button; operators request a pickup and generate a packing
  slip instead.
- Tracking: Delhivery package tracking by AWB/reference ID.
- Cancellation: Delhivery order edit/cancel endpoint before handover.
- Webhooks: idempotent event storage with internal order/shipment status
  mapping.

Provider references:

- [Delhivery B2C API documentation](https://one.delhivery.com/developer-portal/documents/b2c/)
- [Pincode serviceability](https://delhivery-express-api-doc.readme.io/reference/1-pincode-servicability-api)
- [Order creation](https://delhivery-express-api-doc.readme.io/reference/order-creation-api)
- [Invoice/shipping charges](https://delhivery-express-api-doc.readme.io/reference/invoice-shipping-charge-api)
- [Tracking](https://one.delhivery.com/developer-portal/document/b2c/detail/order-tracking)
