# Shiprocket integration

SkinFox keeps shipping credentials and provider calls on the API server. The
storefront only receives a normalized serviceability/quote response, and the
admin panel performs shipment operations after authentication.

## Local setup

Copy the variables below into the **server** environment (not a Vite env file):

```dotenv
SHIPPING_PROVIDER=shiprocket
SHIPROCKET_API_EMAIL=your-api-user@example.com
SHIPROCKET_API_PASSWORD=replace-me
SHIPROCKET_API_BASE_URL=https://apiv2.shiprocket.in/v1/external
SHIPROCKET_PICKUP_LOCATION=Warehouse name exactly as configured in Shiprocket
SHIPROCKET_PICKUP_PINCODE=400001
SHIPROCKET_WEBHOOK_TOKEN=long-random-token
SHIPROCKET_BOOKING_ENABLED=false
SHIPPING_DEFAULT_WEIGHT_KG=0.5
```

Create the API user in Shiprocket under **Settings → API → Configure** and
keep booking disabled while testing serviceability and courier quotes. The
booking flag is an explicit safety switch: when it is `false`, quote and
serviceability calls are available but no live order, AWB or pickup can be
created.

The default package weight is required because the current catalogue does not
store per-variant parcel dimensions. Set it to the measured packed weight for
your standard parcel, or pass exact dimensions and weight in the admin booking
form. Do not use a placeholder for a live shipment.

## Endpoints

- `GET /api/v1/shipping/serviceability?pincode=...&paymentMethod=cod`
- `GET /api/v1/admin/shipping/status`
- `POST /api/v1/admin/shipping/serviceability`
- `POST /api/v1/admin/orders/:id/shipment/quote`
- `POST /api/v1/admin/orders/:id/shipment/book`
- `POST /api/v1/admin/orders/:id/shipment/pickup`
- `POST /api/v1/admin/orders/:id/shipment/label`
- `POST /api/v1/admin/orders/:id/shipment/manifest`
- `POST /api/v1/admin/orders/:id/shipment/cancel`
- `POST /api/v1/admin/orders/:id/shipment/refresh`
- `POST /api/v1/shipping/webhook`

The webhook uses the configured `SHIPROCKET_WEBHOOK_TOKEN` as an application
guard (`x-shiprocket-webhook-token`). It is idempotent and records provider
events before updating the shipment and order timeline. Configure the URL in
Shiprocket as `https://<api-host>/api/v1/shipping/webhook`.

## Operational flow

1. Checkout asks for serviceability and receives the available couriers and
   their estimated delivery information.
2. The checkout quote is stored with the selected provider metadata and an
   expiry timestamp.
3. A paid/COD-authorised order with a complete address can be packed in the
   admin panel.
4. An operator requests quotes, chooses a courier, and explicitly books the
   shipment. Shiprocket order/AWB identifiers are stored on `Shipment`.
5. Pickup, label and manifest actions are separate, auditable operations.
6. Webhooks or an admin refresh update tracking status and customer tracking
   responses without changing the historical order totals.

Waitlist reservation payments are not shipments. The existing conversion flow
must still reveal/prepare the order, collect the address and collect any
remaining balance before an operator books a shipment.

## AWS deployment checklist

Store the variables in AWS Secrets Manager or SSM Parameter Store and inject
them into the API task/container. Run the Prisma migration before starting the
new API build, verify `/api/v1/admin/shipping/status`, test serviceability,
then enable `SHIPROCKET_BOOKING_ENABLED=true` only after confirming the pickup
location and packed dimensions. No credentials are required in the frontend
build and none should be committed to git.
