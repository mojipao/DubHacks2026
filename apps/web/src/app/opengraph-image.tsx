import { ImageResponse } from "next/og";

export const alt = "Back of House: AI drafts every reply for a small bakery; the owner approves it at the pass.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The Devpost card: a ticket on the rail with the counteroffer, stamped SENT. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(160deg, #1d1916 0%, #14110f 60%, #100e0c 100%)",
          color: "#EEE7DD",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 560 }}>
          <div style={{ fontSize: 26, letterSpacing: 6, color: "#F2A541", textTransform: "uppercase" }}>
            Larch &amp; Rye · Back of House
          </div>
          <div style={{ fontSize: 70, lineHeight: 1.04, marginTop: 20, letterSpacing: -2 }}>
            Agents draft. The owner calls it.
          </div>
          <div style={{ fontSize: 28, color: "#9C9188", marginTop: 24, lineHeight: 1.35 }}>
            Customers text the bakery on iMessage. Nothing goes out until the owner approves it at the pass.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 64, flex: 1 }}>
          <div style={{ height: 14, borderRadius: 7, background: "#4a423c", marginBottom: 18 }} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: "#F5EFE4",
              color: "#1B1714",
              borderRadius: 10,
              transform: "rotate(-1.5deg)",
              boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
              position: "relative",
            }}
          >
            <div
              style={{
                background: "#3d342e",
                color: "white",
                fontSize: 18,
                letterSpacing: 3,
                padding: "12px 20px",
                borderTopLeftRadius: 10,
                borderTopRightRadius: 10,
              }}
            >
              INTAKE · REPLY · JUN PARK
            </div>
            <div style={{ display: "flex", flexDirection: "column", padding: 24 }}>
              <div style={{ fontSize: 30, lineHeight: 1.2, letterSpacing: -0.5 }}>
                Can&apos;t fit 48 Saturday: split 24 Sat / 24 Sun, butter reorder needed.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
                {["Over capacity", "Counteroffer"].map((f) => (
                  <div
                    key={f}
                    style={{ fontSize: 15, background: "#f3d3c6", color: "#9a2f12", padding: "4px 10px", borderRadius: 5 }}
                  >
                    {f.toUpperCase()}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 19, color: "#5c534c", marginTop: 16, fontFamily: "monospace" }}>
                read 14 orders · 2 days · 1 ingredient
              </div>
              <div style={{ display: "flex", marginTop: 20 }}>
                <div style={{ fontSize: 18, background: "#2f7d47", color: "white", padding: "8px 16px", borderRadius: 6 }}>
                  Approve both
                </div>
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                right: 28,
                bottom: 22,
                border: "5px solid #2f7d47",
                color: "#2f7d47",
                fontSize: 44,
                fontWeight: 900,
                letterSpacing: 8,
                padding: "6px 16px",
                transform: "rotate(-9deg)",
                fontFamily: "monospace",
              }}
            >
              SENT
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
