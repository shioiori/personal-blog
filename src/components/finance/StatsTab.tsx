import { TrendingUp, TrendingDown, Calendar, AlertCircle } from 'lucide-react'
import { Card } from '../ui/Card'

export default function StatsTab() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Tổng Thu
              </p>
              <p className="mt-2 text-2xl font-bold text-card-foreground">
                {0}
              </p>
            </div>
            <div className="rounded-lg bg-success/10 p-3">
              <TrendingUp className="h-6 w-6 text-success" />
            </div>
          </div>
        </Card>

        <Card className="border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Tổng Chi
              </p>
              <p className="mt-2 text-2xl font-bold text-card-foreground">
                {0}
              </p>
            </div>
            <div className="rounded-lg bg-destructive/10 p-3">
              <TrendingDown className="h-6 w-6 text-destructive" />
            </div>
          </div>
        </Card>

        <Card className="border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Ngày Còn Lại
              </p>
              <p className="mt-2 text-2xl font-bold text-card-foreground">
                {0} ngày
              </p>
            </div>
            <div className="rounded-lg bg-warning/10 p-3">
              <Calendar className="h-6 w-6 text-warning" />
            </div>
          </div>
        </Card>

        <Card className="border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Còn Cần Thu
              </p>
              <p className="mt-2 text-2xl font-bold text-card-foreground">
                {0}
              </p>
            </div>
            <div className="rounded-lg bg-primary/10 p-3">
              <AlertCircle className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-card-foreground">
          Tóm Tắt Chi Tiết
        </h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
            <span className="font-medium text-card-foreground">
              Tổng Thu Được
            </span>
            <span className="text-success font-semibold">+{0}</span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
            <span className="font-medium text-card-foreground">
              Tổng Chi Ra
            </span>
            <span className="text-destructive font-semibold">-{0}</span>
          </div>

          <div className="flex items-center justify-between rounded-lg border-2 border-primary bg-primary/5 p-4">
            <span className="font-medium text-blue-500">Số Dư</span>
            <span
              className={`font-semibold ${
                0 ? 'text-success' : 'text-destructive'
              }`}
            >
              {/* {remainingAmount >= 0 ? '+' : '-'}
              {formatCurrency(Math.abs(remainingAmount))} */}
            </span>
          </div>
        </div>
      </Card>

      {/* {state.incomeRecords.length > 0 && (
        <Card className="border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">
            Mục Tiêu Thu
          </h2>

          <div className="space-y-3">
            {state.incomeRecords.map((record) => {
              const collected = state.transactions
                .filter(
                  (t) => t.type === 'income' && t.incomeRecordId === record.id
                )
                .reduce((sum, t) => sum + t.amount, 0)

              const progress = Math.min((collected / record.amount) * 100, 100)

              return (
                <div
                  key={record.id}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-card-foreground">
                      {record.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatCurrency(collected)} /{' '}
                      {formatCurrency(record.amount)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Math.round(progress)}% đạt được
                  </p>
                </div>
              )
            })}
          </div>
        </Card>
      )} */}
    </div>
  )
}
