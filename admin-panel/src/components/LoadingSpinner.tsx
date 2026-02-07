import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

function LoadingSpinner({ size = 'md', fullScreen = false }: LoadingSpinnerProps) {
  if (fullScreen) {
    return (
      <div className="loading-overlay">
        <div className={`spinner spinner-${size}`}>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        <p className="loading-text">Loading...</p>
      </div>
    );
  }

  return (
    <div className={`spinner spinner-${size}`}>
      <div className="spinner-ring"></div>
      <div className="spinner-ring"></div>
      <div className="spinner-ring"></div>
    </div>
  );
}

export default LoadingSpinner;
