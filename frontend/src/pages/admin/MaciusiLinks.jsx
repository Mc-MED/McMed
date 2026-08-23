const LINKS = [
  {
    category: 'SMS',
    items: [
      {
        label: 'SMSAPI – panel',
        url: 'https://ssl.smsapi.pl/',
        description: 'Logowanie do panelu SMSAPI.pl – zarządzanie kontem, historia wysłanych SMS-ów, tokeny API',
      },
    ],
  },
]

export default function MaciusiLinks() {
  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Linki Maciusia</h1>
        <p className="text-gray-500 text-sm">Przydatne odnośniki do zewnętrznych usług.</p>
      </div>

      <div className="space-y-8">
        {LINKS.map(({ category, items }) => (
          <div key={category}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{category}</p>
            <div className="space-y-3">
              {items.map(({ label, url, description }) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-white rounded-2xl border border-gray-200 px-5 py-4 shadow-sm hover:border-red-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900 group-hover:text-red-600 transition-colors">{label}</span>
                    <span className="text-gray-400 group-hover:text-red-400 transition-colors text-sm">↗</span>
                  </div>
                  {description && (
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{description}</p>
                  )}
                  <p className="text-xs text-gray-300 mt-1 font-mono">{url}</p>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
