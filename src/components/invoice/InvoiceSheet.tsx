import { computeTotals, type BillTo, type InvoiceItem, type InvoiceProfile } from '@/lib/invoiceTypes';
import { fmtDate, fmtMoney } from '@/lib/format';
import CopyButton from './CopyButton';
import FitPages from './FitPages';

// What the sheet needs to draw. A saved InvoiceDoc fits, and so does the live draft in the invoice builder.
export type InvoiceView = {
  number: string;
  status: string;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  days_overdue: number;
  items: InvoiceItem[];
  discount: number;
  advance_paid: number;
  advance_date: string | null;
  terms_label: string;
  payment_terms: string;
  terms: string;
  bill_to: BillTo;
  project_name?: string | null;
  /** Part payment: the project's total, this milestone's name, and what was invoiced before this one. */
  project_total?: number | null;
  part_label?: string;
  prior_billed?: number;
  prior_paid?: number;
};

const TOTAL_PAGES = 2;

// The look of the Buildify quote: black header bar, Inter, hairline tables, A4 pages.
const CSS = `
.inv-root{font-family:'Inter',system-ui,sans-serif;font-size:10.5pt;line-height:1.6;color:#1a1a1a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.inv-root *{box-sizing:border-box}
.inv-page{position:relative;overflow:hidden;width:210mm;min-height:297mm;margin:0 auto 24px;background:#fff;display:flex;flex-direction:column;box-shadow:0 2px 16px rgba(0,0,0,.10);text-align:left}
.inv-head{background:#000;padding:4.5mm 18mm;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.inv-head.cover{padding:7mm 18mm}
.inv-logo{height:19px;width:auto}
.cover .inv-logo{height:30px}
.inv-head-r{font-size:8.5pt;color:#888;letter-spacing:.06em;text-transform:uppercase}
.inv-content{padding:6mm 18mm 0;flex:1}
.inv-foot{padding:3mm 18mm;border-top:1px solid #e0e0e0;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;margin-top:6mm}
.inv-foot-c{font-size:8pt;color:#999}.inv-foot-p{font-size:8pt;color:#bbb}
.inv-label{font-size:8.5pt;color:#999;letter-spacing:.06em;text-transform:uppercase;margin-bottom:2mm}
.inv-title{font-size:24pt;font-weight:600;line-height:1.1;margin-bottom:1mm;word-break:break-word}
.inv-sub{font-size:11pt;color:#666;margin-bottom:8mm}
.inv-hr{border:none;border-top:1px solid #e0e0e0;margin:6mm 0}
.inv-meta{width:100%;border-collapse:collapse;border:1px solid #e0e0e0;margin-bottom:8mm}
.inv-meta td{padding:3.5mm 5mm;font-size:10pt;border:1px solid #e0e0e0;vertical-align:top;word-break:break-word}
.inv-meta td.k{font-weight:600;background:#f9f9f9;width:28mm;white-space:nowrap}
.inv-meta td.v{color:#333;width:47mm}
.inv-over{background:#000;padding:5mm 6mm;margin-bottom:8mm}
.inv-over-l{font-size:8pt;color:#777;text-transform:uppercase;letter-spacing:.08em;margin-bottom:2mm;font-weight:500}
.inv-over-t{font-size:10.5pt;color:#ddd;line-height:1.75}
.inv-over-t strong{color:#fff;font-weight:600}
.inv-auth{margin-top:6mm}
.inv-auth-l{font-size:8.5pt;color:#999;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4mm;font-weight:500}
.inv-sign{border-bottom:1px solid #1a1a1a;width:60mm;height:9mm;margin-bottom:2mm}
.inv-sign-n{font-size:10pt;font-weight:500}.inv-sign-r{font-size:9pt;color:#888}
.inv-pkg{display:flex;align-items:center;justify-content:space-between;gap:4mm;background:#000;padding:3.2mm 6mm}
.inv-pkg-n{font-size:13pt;font-weight:600;color:#fff}
.inv-pkg-p{font-size:16pt;font-weight:600;color:#fff;text-align:right}
.inv-pkg-p small{font-size:9pt;font-weight:500;color:#999;display:block;letter-spacing:.04em}
.inv-tbl{width:100%;border-collapse:collapse;margin-bottom:5mm;border:1px solid #e0e0e0;border-top:none}
.inv-tbl thead tr{background:#f4f4f4;border-bottom:1px solid #e0e0e0}
.inv-tbl thead td{padding:3mm 5mm;font-size:8.5pt;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.07em}
.inv-tbl tbody tr{border-bottom:1px solid #f0f0f0;break-inside:avoid}
.inv-tbl tbody tr:last-child{border-bottom:none}
.inv-tbl tbody td{padding:2.6mm 5mm;font-size:9.4pt;line-height:1.5;color:#333;vertical-align:top;word-break:break-word}
.inv-tbl td.n{font-weight:600;color:#1a1a1a;width:44mm}
.inv-tbl td.r,.inv-tbl thead td.r{text-align:right;white-space:nowrap}
.inv-tbl td.b{font-weight:600;color:#1a1a1a}
.inv-tbl td.pre{white-space:pre-line}
.inv-sec{font-size:8.5pt;font-weight:500;color:#bbb;text-transform:uppercase;letter-spacing:.1em;margin-bottom:3mm}
.inv-tot{display:flex;justify-content:space-between;gap:6mm;padding:2mm 0;border-bottom:1px solid #f0f0f0;font-size:10pt;color:#555}
.inv-tot .v{font-weight:500;color:#1a1a1a;white-space:nowrap}
.inv-tot.grand{border-bottom:none;border-top:2px solid #1a1a1a;margin-top:2mm;padding-top:3.5mm;font-size:13pt;font-weight:600;color:#1a1a1a}
.inv-box{border:1px solid #e0e0e0;background:#f9f9f9;padding:3.2mm 5mm;margin-top:4mm;break-inside:avoid}
.inv-box-l{font-size:8.5pt;font-weight:500;color:#999;text-transform:uppercase;letter-spacing:.1em;margin-bottom:2mm}
.inv-box-t{font-size:10pt;color:#444;line-height:1.7;word-break:break-word}
.inv-box-t strong{color:#1a1a1a;font-weight:600}
.inv-grid2{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
.inv-grid2 .inv-box{margin-top:4mm}
.inv-pay{display:flex;justify-content:space-between;gap:4mm;padding:1.4mm 0;font-size:10pt}
.inv-pay .s{color:#888;font-size:8.5pt;display:block}
.inv-tick{display:inline-block;width:4mm;font-weight:600}
.inv-tt{font-size:15pt;font-weight:600;margin:6mm 0 4mm}
.inv-term{margin-bottom:2.8mm;break-inside:avoid}
.inv-term-k{font-size:10pt;font-weight:600;margin-bottom:1mm}
.inv-term-v{font-size:9.3pt;line-height:1.55;color:#444;white-space:pre-line;word-break:break-word}
.inv-sigs{display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-top:6mm;break-inside:avoid}
.inv-upi{display:inline-block;margin-top:3mm;background:#000;color:#fff!important;text-decoration:none;font-size:9.5pt;font-weight:600;padding:2mm 4.5mm}
.inv-copy{display:inline-flex;vertical-align:middle;margin-left:2mm}
.inv-wm{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%) rotate(-24deg);font-size:96pt;font-weight:800;letter-spacing:.12em;color:rgba(22,163,74,.16);border:5mm solid rgba(22,163,74,.16);padding:2mm 10mm;border-radius:4mm;pointer-events:none;user-select:none;z-index:5}
.inv-page.pg1 .inv-content{padding-top:5mm}
.inv-t1{font-size:19pt;font-weight:600;line-height:1.15;word-break:break-word}
.inv-s1{font-size:10pt;color:#666;margin-bottom:3mm}
.inv-part{display:inline-block;background:#000;color:#fff;font-size:8pt;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:.6mm 2.4mm;margin-left:2mm;vertical-align:middle}
.inv-meta.tight{margin-bottom:0}.inv-meta.tight td{padding:2mm 4mm;font-size:9pt}
.inv-meta.tight td.k{width:24mm}.inv-meta.tight td.v{width:auto}
.inv-lines{font-size:9.5pt;color:#444}.inv-lines div{padding:.6mm 0;display:flex;justify-content:space-between;gap:3mm;word-break:break-word}.inv-lines div span:first-child{color:#888;white-space:nowrap}.inv-lines div span:last-child{text-align:right;font-weight:500;color:#1a1a1a}
@media print{
  @page{size:A4;margin:0}
  .inv-page{margin:0;box-shadow:none;break-after:page}
  .inv-page:last-child{break-after:auto}
  .inv-fit{zoom:1!important}
}
`;

function stateOf(v: InvoiceView, balance: number) {
  if (v.status === 'paid') return 'Paid';
  if (v.days_overdue > 0) return `${v.days_overdue} day${v.days_overdue === 1 ? '' : 's'} overdue`;
  return balance > 0 ? 'Payment due' : 'Paid';
}

function Page({ n, right, cover, paid, className, children, profile }: { n: number; right: string; cover?: boolean; paid?: boolean; className?: string; children: React.ReactNode; profile: InvoiceProfile }) {
  const contact = [profile.phone, profile.email].filter(Boolean).join('  |  ');
  return (
    <div className={`inv-page${className ? ` ${className}` : ''}`}>
      {paid && <div className="inv-wm" aria-hidden>PAID</div>}
      <div className={`inv-head${cover ? ' cover' : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="inv-logo" src="/logo-wordmark.png" alt={profile.business_name || 'Buildify'} />
        <div className="inv-head-r">{right}</div>
      </div>
      <div className="inv-content">{children}</div>
      <div className="inv-foot">
        <div className="inv-foot-c">{contact || profile.business_name}</div>
        <div className="inv-foot-p">
          {n} / {TOTAL_PAGES}
        </div>
      </div>
    </div>
  );
}

function Block({ label, name, rows }: { label: string; name: string; rows: (string | undefined)[] }) {
  return (
    <div className="inv-box">
      <div className="inv-box-l">{label}</div>
      <div className="inv-box-t">
        <strong>{name || '—'}</strong>
        {rows.filter(Boolean).map((r, i) => (
          <div key={i} style={{ whiteSpace: 'pre-line' }}>
            {r}
          </div>
        ))}
      </div>
    </div>
  );
}

// Two A4 pages in the Buildify quote style: the invoice itself (with payment details), then terms and signatures.
export default function InvoiceSheet({ v, profile }: { v: InvoiceView; profile: InvoiceProfile }) {
  const t = computeTotals(v.items, v.discount, v.advance_paid);
  const paid = v.status === 'paid';
  const b = v.bill_to;
  const state = stateOf(v, t.balance);
  const subject = v.project_name || v.items[0]?.description || 'Services';
  const biz = profile.business_name || 'Buildify';
  const upi =
    profile.upi_id && !paid
      ? `upi://pay?pa=${encodeURIComponent(profile.upi_id)}&pn=${encodeURIComponent(biz)}&am=${t.balance.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice ${v.number}`)}`
      : null;
  const bankRows: [string, string][] = [
    ['Account name', profile.account_name],
    ['Bank', profile.bank_name],
    ['Account no.', profile.account_number],
    ['IFSC', profile.ifsc],
    ['UPI ID', profile.upi_id]
  ];
  const bank = bankRows.filter(([, val]) => val);
  // Part payment: where this invoice sits in the project's total.
  const part = v.project_total != null && v.project_total > 0;
  const projTotal = v.project_total ?? 0;
  const before = v.prior_billed ?? 0;
  const earlier = v.prior_paid ?? 0;
  const afterThis = Math.max(0, projTotal - earlier - before - t.total);

  return (
    <div className="inv-root invoice-sheet">
      <style>{CSS}</style>
      <FitPages>
        {/* PAGE 1: THE INVOICE */}
        <Page n={1} right={`Invoice ${v.number || ''}`} paid={paid} className="pg1" profile={profile}>
          <div className="inv-label">Invoice for</div>
          <div className="inv-t1">{b.name || '—'}</div>
          <div className="inv-s1">
            {subject !== b.name && subject}
            {part && <span className="inv-part">{v.part_label?.trim() || 'Part payment'}</span>}
          </div>
          <table className="inv-meta tight">
            <tbody>
              <tr>
                <td className="k">Invoice</td>
                <td className="v">{v.number || '—'}</td>
                <td className="k">Date</td>
                <td className="v">{v.issue_date ? fmtDate(v.issue_date) : '—'}</td>
              </tr>
              <tr>
                <td className="k">Status</td>
                <td className="v">{state}</td>
                <td className="k">Due Date</td>
                <td className="v">{v.due_date ? fmtDate(v.due_date) : '—'}</td>
              </tr>
            </tbody>
          </table>
          <div className="inv-grid2">
            <Block label="Bill To" name={b.name} rows={[b.contact_name, b.address, b.email, b.phone, b.gstin && `GSTIN: ${b.gstin}`]} />
            <Block label="From" name={biz} rows={[profile.address, profile.email, profile.phone, profile.gstin && `GSTIN: ${profile.gstin}`]} />
          </div>

          <div className="inv-pkg" style={{ marginTop: '5mm' }}>
            <div className="inv-pkg-n">Invoice Details</div>
            <div className="inv-pkg-p">
              {paid ? 'Paid' : fmtMoney(t.balance)}
              <small>{paid ? 'No balance due' : 'Balance due'}</small>
            </div>
          </div>
          <table className="inv-tbl" style={{ marginBottom: '3mm' }}>
            <thead>
              <tr>
                <td>Item</td>
                <td className="r">Qty</td>
                <td className="r">Rate</td>
                <td className="r">Amount</td>
              </tr>
            </thead>
            <tbody>
              {v.items.map((i, n) => (
                <tr key={n}>
                  <td className="n pre" style={{ width: 'auto' }}>{i.description}</td>
                  <td className="r">{i.qty}</td>
                  <td className="r">{fmtMoney(i.rate)}</td>
                  <td className="r b">{fmtMoney(i.qty * i.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginLeft: 'auto', width: '88mm' }}>
            <div className="inv-tot">
              <div>Subtotal</div>
              <div className="v">{fmtMoney(t.subtotal)}</div>
            </div>
            {t.discount > 0 && (
              <div className="inv-tot">
                <div>Discount</div>
                <div className="v">− {fmtMoney(t.discount)}</div>
              </div>
            )}
            <div className="inv-tot">
              <div>Total</div>
              <div className="v">{fmtMoney(t.total)}</div>
            </div>
            {t.advance > 0 && (
              <div className="inv-tot">
                <div>Amount paid{v.advance_date ? ` (${fmtDate(v.advance_date)})` : ''}</div>
                <div className="v">− {fmtMoney(t.advance)}</div>
              </div>
            )}
            {paid && t.balance > 0 && (
              <div className="inv-tot">
                <div>Final payment{v.paid_date ? ` (${fmtDate(v.paid_date)})` : ''}</div>
                <div className="v">− {fmtMoney(t.balance)}</div>
              </div>
            )}
            <div className="inv-tot grand">
              <div>{paid ? 'Balance' : 'Balance Due'}</div>
              <div className="v">{fmtMoney(paid ? 0 : t.balance)}</div>
            </div>
          </div>

          <div className="inv-grid2">
            <div className="inv-box">
              <div className="inv-box-l">{paid ? 'Payment receipt' : 'Payments'}</div>
              {t.advance > 0 && (
                <div className="inv-pay">
                  <span>
                    <span className="inv-tick">✓</span>Advance received
                    <span className="s" style={{ paddingLeft: '4mm' }}>{v.advance_date ? fmtDate(v.advance_date) : '—'}</span>
                  </span>
                  <strong>{fmtMoney(t.advance)}</strong>
                </div>
              )}
              <div className="inv-pay">
                <span>
                  <span className="inv-tick">{paid ? '✓' : '•'}</span>
                  {t.advance > 0 ? 'Final payment' : 'Payment'}
                  <span className="s" style={{ paddingLeft: '4mm' }}>
                    {paid ? (v.paid_date ? `Paid ${fmtDate(v.paid_date)}` : 'Paid') : `Due ${v.due_date ? fmtDate(v.due_date) : '—'}`}
                  </span>
                </span>
                <strong>{fmtMoney(t.balance)}</strong>
              </div>
              {paid && <div style={{ fontSize: '9pt', color: '#15803d', marginTop: '1mm' }}>Paid in full. Thank you for your business.</div>}
            </div>
            {!paid && (
              <div className="inv-box">
                <div className="inv-box-l">How to pay</div>
                {bank.length > 0 ? (
                  <div className="inv-lines">
                    {bank.map(([k, val]) => (
                      <div key={k}>
                        <span>{k}</span>
                        <span>
                          {val}
                          {(k === 'Account no.' || k === 'IFSC' || k === 'UPI ID') && (
                            <span className="inv-copy">
                              <CopyButton value={val} />
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                    <div>
                      <span>Reference</span>
                      <span>{v.number}</span>
                    </div>
                  </div>
                ) : (
                  <div className="inv-box-t">Please contact {biz}{profile.email ? ` at ${profile.email}` : ''} for payment details.</div>
                )}
                {upi && (
                  <div className="no-print">
                    <a className="inv-upi" href={upi}>
                      Pay {fmtMoney(t.balance)} with UPI
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </Page>

        {/* PAGE 2: TERMS + SIGNATURES */}
        <Page n={2} right="Terms & Conditions" paid={paid} profile={profile}>
          {part && (
            <>
              <div className="inv-sec">Project Payment Schedule</div>
              <div style={{ marginBottom: '6mm' }}>
                <div className="inv-tot">
                  <div>Project total</div>
                  <div className="v">{fmtMoney(projTotal)}</div>
                </div>
                {earlier > 0 && (
                  <div className="inv-tot">
                    <div>Paid earlier ({Math.round((earlier / projTotal) * 1000) / 10}%, before this system)</div>
                    <div className="v">{fmtMoney(earlier)}</div>
                  </div>
                )}
                <div className="inv-tot">
                  <div>Invoiced before this invoice</div>
                  <div className="v">{fmtMoney(before)}</div>
                </div>
                <div className="inv-tot">
                  <div>
                    This invoice — {v.part_label?.trim() || 'Part payment'} ({Math.round((t.total / projTotal) * 1000) / 10}%)
                  </div>
                  <div className="v">{fmtMoney(t.total)}</div>
                </div>
                <div className="inv-tot grand">
                  <div>Left to invoice after this</div>
                  <div className="v">{fmtMoney(afterThis)}</div>
                </div>
              </div>
            </>
          )}
          <div className="inv-tt" style={{ marginTop: 0 }}>Terms &amp; Conditions</div>
          {(v.terms_label || v.payment_terms) && (
            <div className="inv-term">
              <div className="inv-term-k">Payment Terms</div>
              <div className="inv-term-v">{[v.terms_label, v.payment_terms].filter(Boolean).join('\n')}</div>
            </div>
          )}
          {v.terms && (
            <div className="inv-term">
              <div className="inv-term-k">Terms</div>
              <div className="inv-term-v">{v.terms}</div>
            </div>
          )}
          {!v.terms_label && !v.payment_terms && !v.terms && <div className="inv-term-v" style={{ color: '#888' }}>No additional terms for this invoice.</div>}

          <hr className="inv-hr" style={{ margin: '6mm 0 4mm' }} />
          <div className="inv-sigs">
            <div>
              <div className="inv-auth-l">Authorised by — {biz}</div>
              <div className="inv-sign" style={{ width: 'auto' }} />
              <div className="inv-sign-n">{biz}</div>
              {profile.gstin && <div className="inv-sign-r">GSTIN: {profile.gstin}</div>}
            </div>
            <div>
              <div className="inv-auth-l">Received by — {b.name || 'Client'}</div>
              <div className="inv-sign" style={{ width: 'auto' }} />
              <div className="inv-sign-r">{b.contact_name ? `${b.contact_name} · ` : ''}Name &amp; Date</div>
            </div>
          </div>
        </Page>
      </FitPages>
    </div>
  );
}
