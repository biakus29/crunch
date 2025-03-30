import { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Container, Button, Alert } from "react-bootstrap";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage(""); // Réinitialiser les erreurs
    setSuccessMessage(""); // Réinitialiser les succès

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setSuccessMessage("Connexion réussie !");
      navigate("/admin-restaurant/:id"); // Rediriger vers l'interface du gestionnaire
    } catch (error) {
      setErrorMessage("Erreur lors de la connexion. Vérifiez vos identifiants.");
      console.error("Erreur lors de la connexion :", error);
    }
  };

  return (
    <Container className="mt-4">
      <h2>Connexion</h2>

      {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      <form onSubmit={handleLogin}>
        <div className="mb-3">
          <label>Email</label>
          <input
            type="email"
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            
          />
        </div>
        <div className="mb-3">
          <label>Mot de passe</label>
          <input
            type="password"
            className="form-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="btn btn-primary">
          Se connecter
        </Button>
      </form>
    </Container>
  );
};

export default Login;