import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const AdminRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Si l'utilisateur est connecté, essayer de le rediriger vers l'admin
        navigate('/admin-restaurant');
      } else {
        // Sinon, aller vers le login client
        navigate('/loginrestau');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
};

export default AdminRedirect;
