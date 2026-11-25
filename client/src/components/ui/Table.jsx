export function Table({ columns, data = [], keyField = '_id', onRowClick, empty = null }) {
  if (!data || data.length === 0) {
    return empty || null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-[#1F2533] text-[11px] uppercase tracking-wider text-slate-400">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-3 px-4 font-medium ${col.align === 'right' ? 'text-right' : ''} ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1F2533]/70 text-sm">
          {data.map((row) => (
            <tr
              key={row[keyField] || row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`hover:bg-[#1F2533]/40 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`py-3.5 px-4 ${col.align === 'right' ? 'text-right tabular-nums' : ''} ${col.cellClassName || ''}`}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
