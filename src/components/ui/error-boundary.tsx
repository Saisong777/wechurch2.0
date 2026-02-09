import { Component, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
    console.error('[ErrorBoundary] Caught error:', error.message, errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="py-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="text-error-title">
                {this.props.fallbackTitle || '頁面載入失敗'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4" data-testid="text-error-message">
                很抱歉，頁面發生了錯誤。請嘗試重新載入。
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={this.handleRetry} data-testid="button-retry">
                  重試
                </Button>
                <Button onClick={this.handleReload} data-testid="button-reload">
                  <RefreshCw className="w-4 h-4 mr-1" />
                  重新載入
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
