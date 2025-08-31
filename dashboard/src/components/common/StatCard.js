// components/common/StatCard.js
const StatCard = ({ title, value, icon, color = "blue", subtitle, theme }) => (
  <div className={`${theme.cardBg} p-6 rounded-lg shadow-sm ${theme.border} border`}>
    <div className="flex items-center justify-between">
      <div>
        <p className={`text-sm font-medium ${theme.textMuted}`}>{title}</p>
        <p className={`text-3xl font-bold ${theme.text}`}>{value || 0}</p>
        {subtitle && (
          <p className={`text-xs ${theme.textMuted} mt-1`}>{subtitle}</p>
        )}
      </div>
      <div className={`text-${color}-500 text-2xl`}>{icon}</div>
    </div>
  </div>
);

export default StatCard;