import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Tab, Tabs, Container, Button, Table, Alert, Form, Spinner } from "react-bootstrap";
import "../styles/addrestaurants.css";

const SuperAdmin = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [activeTab, setActiveTab] = useState("restaurants");
  const [name, setName] = useState("");
  const [adresse, setAdresse] = useState("");
  const [city, setCity] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPartner, setIsPartner] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [restaurantToEdit, setRestaurantToEdit] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Charger les restaurants depuis Firebase
  useEffect(() => {
    const fetchRestaurants = async () => {
      setIsLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, "restaurants"));
        setRestaurants(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        setErrorMessage("Erreur lors du chargement des restaurants : " + error.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRestaurants();
  }, []);

  // Réinitialiser les messages d'erreur et succès
  const resetMessages = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  // Ajouter un restaurant
  const handleAddRestaurant = async (e) => {
    e.preventDefault();
    resetMessages();
    setIsLoading(true);

    if (!name || !adresse || !city || !contact || !email || !password) {
      setErrorMessage("Tous les champs sont obligatoires.");
      setIsLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const restaurantRef = doc(collection(db, "restaurants"));
      await setDoc(restaurantRef, {
        id: restaurantRef.id,
        name,
        adresse,
        city,
        contact,
        email,
        isPartner,
        uid: userCredential.user.uid,
        idMenu: null,
        location: null,
      });

      setSuccessMessage("Restaurant créé avec succès !");
      setName("");
      setAdresse("");
      setCity("");
      setContact("");
      setEmail("");
      setPassword("");
      setIsPartner(false);

      // Rediriger vers l'onglet de liste après ajout
      setActiveTab("list");
      navigate("/superadmin"); // Assure-toi que cette route existe
    } catch (error) {
      setErrorMessage("Erreur lors de la création du restaurant : " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Supprimer un restaurant
  const handleDeleteRestaurant = async (id) => {
    resetMessages();
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, "restaurants", id));
      setRestaurants(restaurants.filter(restaurant => restaurant.id !== id));
      setSuccessMessage("Restaurant supprimé avec succès !");
    } catch (error) {
      setErrorMessage("Erreur lors de la suppression du restaurant : " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Mettre à jour un restaurant
  const handleUpdateRestaurant = async (e) => {
    e.preventDefault();
    resetMessages();
    setIsLoading(true);

    if (!restaurantToEdit) {
      setErrorMessage("Aucun restaurant sélectionné pour la modification.");
      setIsLoading(false);
      return;
    }

    try {
      const restaurantRef = doc(db, "restaurants", restaurantToEdit.id);
      await updateDoc(restaurantRef, {
        name,
        adresse,
        city,
        contact,
        email,
        isPartner,
      });

      setSuccessMessage("Restaurant mis à jour avec succès !");
      setRestaurantToEdit(null);
      setActiveTab("list"); // Retourner à la liste après mise à jour
      navigate("/superadmin"); // Redirection
    } catch (error) {
      setErrorMessage("Erreur lors de la mise à jour du restaurant : " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Charger les informations du restaurant à modifier
  const handleEditRestaurant = (restaurant) => {
    resetMessages();
    setRestaurantToEdit(restaurant);
    setName(restaurant.name);
    setAdresse(restaurant.adresse);
    setCity(restaurant.city);
    setContact(restaurant.contact);
    setEmail(restaurant.email);
    setIsPartner(restaurant.isPartner);
    setActiveTab("edit");
  };

  return (
    <Container className="mt-4">
      <h2 className="text-center mb-4">Gestion des Restaurants</h2>

      {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      <Tabs activeKey={activeTab} onSelect={(k) => { resetMessages(); setActiveTab(k); }} className="mb-3">
        <Tab eventKey="restaurants" title="Ajouter un Restaurant">
          <h3 className="mt-3">Ajouter un Restaurant</h3>
          <Form onSubmit={handleAddRestaurant}>
            <Form.Group className="mb-3">
              <Form.Label>Nom du Restaurant</Form.Label>
              <Form.Control type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Adresse</Form.Label>
              <Form.Control type="text" value={adresse} onChange={(e) => setAdresse(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Ville</Form.Label>
              <Form.Control type="text" value={city} onChange={(e) => setCity(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Contact</Form.Label>
              <Form.Control type="text" value={contact} onChange={(e) => setContact(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Mot de passe</Form.Label>
              <Form.Control type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check 
                type="checkbox"
                label="Partenaire ?"
                checked={isPartner}
                onChange={(e) => setIsPartner(e.target.checked)}
              />
            </Form.Group>
            <Button variant="primary" type="submit" disabled={isLoading}>
              {isLoading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : "Ajouter"}
            </Button>
          </Form>
        </Tab>

        <Tab eventKey="edit" title="Modifier un Restaurant">
          <h3 className="mt-3">Modifier un Restaurant</h3>
          {restaurantToEdit ? (
            <Form onSubmit={handleUpdateRestaurant}>
              <Form.Group className="mb-3">
                <Form.Label>Nom du Restaurant</Form.Label>
                <Form.Control type="text" value={name} onChange={(e) => setName(e.target.value)} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Adresse</Form.Label>
                <Form.Control type="text" value={adresse} onChange={(e) => setAdresse(e.target.value)} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Ville</Form.Label>
                <Form.Control type="text" value={city} onChange={(e) => setCity(e.target.value)} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Contact</Form.Label>
                <Form.Control type="text" value={contact} onChange={(e) => setContact(e.target.value)} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Check 
                  type="checkbox"
                  label="Partenaire ?"
                  checked={isPartner}
                  onChange={(e) => setIsPartner(e.target.checked)}
                />
              </Form.Group>
              <Button variant="primary" type="submit" disabled={isLoading}>
                {isLoading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : "Mettre à jour"}
              </Button>
            </Form>
          ) : (
            <p>Veuillez sélectionner un restaurant à modifier.</p>
          )}
        </Tab>

        <Tab eventKey="list" title="Liste des Restaurants">
          <h3 className="mt-3">Liste des Restaurants</h3>
          {isLoading ? (
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Chargement...</span>
            </Spinner>
          ) : (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Adresse</th>
                  <th>Ville</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Partenaire</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {restaurants.map((restaurant) => (
                  <tr key={restaurant.id}>
                    <td>{restaurant.name}</td>
                    <td>{restaurant.adresse}</td>
                    <td>{restaurant.city}</td>
                    <td>{restaurant.contact}</td>
                    <td>{restaurant.email}</td>
                    <td>{restaurant.isPartner ? "Oui" : "Non"}</td>
                    <td>
                      <Button variant="warning" size="sm" onClick={() => handleEditRestaurant(restaurant)}>
                        Modifier
                      </Button>{" "}
                      <Button variant="danger" size="sm" onClick={() => handleDeleteRestaurant(restaurant.id)}>
                        Supprimer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Tab>
      </Tabs>
    </Container>
  );
};

export default SuperAdmin;