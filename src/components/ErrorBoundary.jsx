import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdfbf7] p-4 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-[#4a3728] mb-2">Oups ! Une erreur est survenue.</h1>
          <p className="text-gray-600 mb-6 max-w-md">
            Nous avons rencontré un problème lors du chargement de la page. Essayez de rafraîchir.
          </p>
          <div className="flex gap-4">
            <Button 
              onClick={() => window.location.reload()} 
              className="bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5]"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Rafraîchir la page
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                  // Try to clear cache/storage just in case
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.href = '/';
              }}
              className="border-[#d4c5b0] text-[#6b5138]"
            >
              Retour à l'accueil (Reset)
            </Button>
          </div>
          {this.state.error && (
             <pre className="mt-8 p-4 bg-gray-100 rounded text-left text-xs text-red-500 overflow-auto max-w-lg max-h-40">
                 {this.state.error.toString()}
             </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;