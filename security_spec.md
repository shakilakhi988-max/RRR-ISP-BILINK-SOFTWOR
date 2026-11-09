# Security Specification — maXim ISP Billing & ERP

## 1. Data Invariants
1. **Default-Deny Catch-All**: Unmatched paths (`/{document=**}`) deny all reads and writes unconditionally.
2. **Verified Tenant Ownership**: Every operational collection document (`workspaceSettings`, `pops`, `packages`, `routers`, `customers`, `resellers`, `employees`, `payments`, `tickets`, `tasks`, `corporateClients`, `ledgerEntries`, `operationalLogs`) belongs to exactly one `ownerUid` matching `request.auth.uid` with `request.auth.token.email_verified == true` (or verified bootstrapped admin `rendomuser50@gmail.com`).
3. **Subcollection Master Gate**: A `TicketComment` (`/tickets/{ticketId}/comments/{commentId}`) cannot be read or written unless the parent `/tickets/{ticketId}` document exists and its `ownerUid == request.auth.uid` (or bootstrapped admin).
4. **Strict Key & Size Enforcement**: Every create and update operation enforces `hasAll` and `hasOnly` field allowlists, string `.size()` ceilings matching `firebase-blueprint.json`, ID regex guards (`^[a-zA-Z0-9_\-]+$`), and server timestamps (`request.time`).
5. **Immutable Identity & Creation Timestamps**: `ownerUid` and `createdAt` can never be mutated during `update`.
6. **Terminal State Locking**: Once a `PaymentRecord` or `LedgerEntry` reaches terminal status `'Void'`, non-admin updates are rejected.
7. **Zero Client Query Trust / Zero O(n) List Lookups**: Every `allow list` rule validates `resource.data.ownerUid == request.auth.uid` (or verified bootstrap email) directly on `resource.data` without invoking `get()` or `exists()`.

## 2. The "Dirty Dozen" Payloads
1. **Identity Spoofing on Create**: Creating `/customers/cust_1` with `ownerUid: "victim_uid"` while authenticated as `"attacker_uid"`.
2. **Unverified Email Spoof**: Accessing `/customers/cust_1` with `email: "rendomuser50@gmail.com"` and `email_verified: false`.
3. **Shadow Field Injection on Create**: Creating `/packages/pkg_1` with an undeclared field `"isFreeForever": true`.
4. **Shadow Field Injection on Update**: Updating `/customers/cust_1` with `"hiddenAdminFlag": true`.
5. **Value Poisoning on Update**: Updating whitelisted key `balance` on `/customers/cust_1` with a `string` `"999999"` instead of `number`.
6. **Resource Exhaustion / ID Poisoning**: Creating `/pops/<200-char-junk-id!@#>` violating `isValidId()`.
7. **Denial-of-Wallet Oversized String**: Creating `/tickets/tkt_1` with a 50KB `description` exceeding `size() <= 1000`.
8. **Immortal Field Mutation**: Updating `/customers/cust_1` to change `ownerUid` or `createdAt`.
9. **Client Timestamp Forgery**: Creating `/payments/pay_1` with a backdated client timestamp (`createdAt != request.time`).
10. **Terminal State Reversal**: Non-admin attempting to update a `PaymentRecord` whose existing `status == 'Void'`.
11. **PII Cross-Tenant Read**: Authenticated user `"user_b"` attempting `get` or `list` on `"user_a"`'s `/customers` or `/employees` records containing phone/email/NID PII.
12. **Orphaned Subcollection Write**: Creating `/tickets/non_existent_tkt/comments/cmt_1` when `/tickets/non_existent_tkt` does not exist or belongs to another tenant.
