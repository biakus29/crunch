// Gestionnaire d'erreurs Firebase pour l'authentification
export const getFirebaseErrorMessage = (error) => {
  const errorMessages = {
    // Erreurs d'authentification
    'auth/email-already-in-use': 'Cet email est déjà utilisé par un autre compte',
    'auth/weak-password': 'Le mot de passe doit contenir au moins 6 caractères',
    'auth/invalid-email': 'Adresse email invalide',
    'auth/user-not-found': 'Aucun compte trouvé avec cet email',
    'auth/wrong-password': 'Mot de passe incorrect',
    'auth/invalid-credential': 'Identifiants invalides',
    'auth/too-many-requests': 'Trop de tentatives. Veuillez réessayer plus tard',
    'auth/network-request-failed': 'Erreur de réseau. Vérifiez votre connexion',
    'auth/popup-blocked': 'Popup bloqué. Autorisez les popups pour ce site',
    'auth/popup-closed-by-user': 'Connexion annulée par l\'utilisateur',
    'auth/account-exists-with-different-credential': 'Un compte existe déjà avec cet email mais avec un autre fournisseur',
    'auth/credential-already-in-use': 'Ces identifiants sont déjà utilisés par un autre compte',
    'auth/operation-not-allowed': 'Cette opération n\'est pas autorisée',
    'auth/user-disabled': 'Ce compte a été désactivé',
    'auth/user-token-expired': 'Session expirée. Veuillez vous reconnecter',
    'auth/invalid-user-token': 'Token utilisateur invalide',
    'auth/user-mismatch': 'L\'utilisateur ne correspond pas aux identifiants fournis',
    'auth/requires-recent-login': 'Cette opération nécessite une connexion récente',
    'auth/email-already-exists': 'Cet email est déjà utilisé',
    'auth/phone-number-already-exists': 'Ce numéro de téléphone est déjà utilisé',
    'auth/invalid-phone-number': 'Numéro de téléphone invalide',
    'auth/quota-exceeded': 'Quota dépassé. Veuillez réessayer plus tard',
    'auth/missing-phone-number': 'Numéro de téléphone requis',
    'auth/invalid-verification-code': 'Code de vérification invalide',
    'auth/invalid-verification-id': 'ID de vérification invalide',
    'auth/missing-verification-code': 'Code de vérification requis',
    'auth/missing-verification-id': 'ID de vérification requis',
    'auth/code-expired': 'Code de vérification expiré',
    'auth/invalid-credential': 'Identifiants invalides',
    'auth/custom-token-mismatch': 'Token personnalisé ne correspond pas',
    'auth/invalid-custom-token': 'Token personnalisé invalide',
    'auth/captcha-check-failed': 'Vérification CAPTCHA échouée',
    'auth/invalid-app-credential': 'Identifiants d\'application invalides',
    'auth/invalid-app-id': 'ID d\'application invalide',
    'auth/invalid-argument': 'Argument invalide',
    'auth/invalid-claims': 'Claims invalides',
    'auth/invalid-continue-uri': 'URI de continuation invalide',
    'auth/invalid-dynamic-link-domain': 'Domaine de lien dynamique invalide',
    'auth/invalid-email': 'Email invalide',
    'auth/invalid-emulator-scheme': 'Schéma d\'émulateur invalide',
    'auth/invalid-id-token': 'Token ID invalide',
    'auth/invalid-message-payload': 'Payload de message invalide',
    'auth/invalid-multi-factor-session': 'Session multi-facteurs invalide',
    'auth/invalid-oauth-provider': 'Fournisseur OAuth invalide',
    'auth/invalid-oauth-client-id': 'ID client OAuth invalide',
    'auth/invalid-page-token': 'Token de page invalide',
    'auth/invalid-persistence-type': 'Type de persistance invalide',
    'auth/invalid-phone-number': 'Numéro de téléphone invalide',
    'auth/invalid-provider-data': 'Données de fournisseur invalides',
    'auth/invalid-recipient-email': 'Email destinataire invalide',
    'auth/invalid-sender': 'Expéditeur invalide',
    'auth/invalid-session-cookie-duration': 'Durée de cookie de session invalide',
    'auth/invalid-uid': 'UID invalide',
    'auth/invalid-user-import': 'Import utilisateur invalide',
    'auth/maximum-user-count-exceeded': 'Nombre maximum d\'utilisateurs dépassé',
    'auth/missing-android-pkg-name': 'Nom de package Android manquant',
    'auth/missing-continue-uri': 'URI de continuation manquante',
    'auth/missing-ios-bundle-id': 'ID de bundle iOS manquant',
    'auth/missing-uid': 'UID manquant',
    'auth/operation-not-allowed': 'Opération non autorisée',
    'auth/project-not-found': 'Projet non trouvé',
    'auth/reserved-claims': 'Claims réservés',
    'auth/session-cookie-expired': 'Cookie de session expiré',
    'auth/session-cookie-revoked': 'Cookie de session révoqué',
    'auth/uid-already-exists': 'UID déjà utilisé',
    'auth/unauthorized-continue-uri': 'URI de continuation non autorisée',
    'auth/user-not-found': 'Utilisateur non trouvé',
    'auth/weak-password': 'Mot de passe faible',
    'auth/web-storage-unsupported': 'Stockage web non supporté',
    
    // Erreurs Firestore
    'permission-denied': 'Permission refusée',
    'unavailable': 'Service temporairement indisponible',
    'deadline-exceeded': 'Délai dépassé',
    'unauthenticated': 'Non authentifié',
    'not-found': 'Ressource non trouvée',
    'already-exists': 'Ressource déjà existante',
    'failed-precondition': 'Condition préalable échouée',
    'aborted': 'Opération abandonnée',
    'out-of-range': 'Valeur hors limites',
    'unimplemented': 'Fonctionnalité non implémentée',
    'internal': 'Erreur interne',
    'data-loss': 'Perte de données',
    'resource-exhausted': 'Ressources épuisées',
    'cancelled': 'Opération annulée',
    'unknown': 'Erreur inconnue'
  };

  return errorMessages[error.code] || error.message || 'Une erreur inattendue s\'est produite';
};

// Fonction pour gérer les erreurs Firebase avec toast
export const handleFirebaseError = (error, toast) => {
  const message = getFirebaseErrorMessage(error);
  console.error('Erreur Firebase:', error);
  
  if (toast) {
    toast.error(message);
  } else {
    alert(`Erreur: ${message}`);
  }
  
  return message;
};

// Fonction pour vérifier si une erreur est liée à l'authentification
export const isAuthError = (error) => {
  return error.code && error.code.startsWith('auth/');
};

// Fonction pour vérifier si une erreur est liée à Firestore
export const isFirestoreError = (error) => {
  return error.code && !error.code.startsWith('auth/');
};

// Fonction pour obtenir des suggestions d'action basées sur l'erreur
export const getErrorSuggestions = (error) => {
  const suggestions = {
    'auth/email-already-in-use': [
      'Utilisez "Lier un compte existant" à la place',
      'Vérifiez si l\'email est correct',
      'Contactez l\'administrateur si nécessaire'
    ],
    'auth/weak-password': [
      'Utilisez au moins 6 caractères',
      'Ajoutez des chiffres et des symboles',
      'Évitez les mots de passe courants'
    ],
    'auth/user-not-found': [
      'Vérifiez l\'adresse email',
      'Assurez-vous que le compte existe',
      'Utilisez "Créer un nouveau compte" à la place'
    ],
    'auth/wrong-password': [
      'Vérifiez le mot de passe',
      'Utilisez "Réinitialiser le mot de passe" si nécessaire',
      'Contactez l\'utilisateur pour confirmer'
    ],
    'auth/network-request-failed': [
      'Vérifiez votre connexion internet',
      'Réessayez dans quelques instants',
      'Contactez le support technique si le problème persiste'
    ]
  };

  return suggestions[error.code] || ['Contactez le support technique'];
};

