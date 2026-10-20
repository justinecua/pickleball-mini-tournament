import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** Renders `value` as a QR image, with an optional PNG download. */
export default function QrCode({ value, size = 220, filename, caption, className = '' }) {
  const [src, setSrc] = useState(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, { width: size * 2, margin: 1, color: { dark: '#29332e', light: '#ffffff' } })
      .then((url) => { if (!cancelled) setSrc(url) })
      .catch(() => { if (!cancelled) setSrc(null) })
    return () => { cancelled = true }
  }, [value, size])

  return (
    <figure className={`inline-flex flex-col items-center ${className}`}>
      <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-line" style={{ width: size + 24, height: size + 24 }}>
        {src && <img src={src} alt={caption ? `QR code: ${caption}` : 'QR code'} width={size} height={size} />}
      </div>
      {caption && <figcaption className="label mt-3 text-center text-ink/60">{caption}</figcaption>}
      {filename && src && (
        <a href={src} download={filename} className="mt-2 text-sm font-semibold text-olive hover:underline">Download PNG</a>
      )}
    </figure>
  )
}
