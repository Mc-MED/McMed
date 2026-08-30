import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export default function PdfViewer({ url }) {
  const [numPages, setNumPages] = useState(null)
  const [width, setWidth] = useState(800)
  const containerRef = useRef()

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(entries => {
      setWidth(entries[0].contentRect.width)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto bg-gray-100"
      style={{ height: '75vh' }}
    >
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
            Ładowanie…
          </div>
        }
        error={
          <div className="flex items-center justify-center py-20 text-red-500 text-sm">
            Błąd ładowania PDF.
          </div>
        }
      >
        {Array.from({ length: numPages || 0 }, (_, i) => (
          <Page
            key={i + 1}
            pageNumber={i + 1}
            width={width}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="mb-2 shadow-sm"
          />
        ))}
      </Document>
    </div>
  )
}
