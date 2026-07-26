<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ApiError, type FieldErrors, type User } from "../services/authService";
import { changePassword, getUserPreferences, getUserSecurity, updateUserPreferences, type UserSecurity } from "../services/userService";
import DataImportExportPanel from "./DataImportExportPanel.vue";

const emit = defineEmits<{
  updated: [user: User];
}>();

type FormErrors = Record<string, string>;

const displayName = ref("");
const email = ref("");
const defaultPortions = ref(2);
const diet = ref("");
const favoriteCuisine = ref("");
const allergiesText = ref("");
const security = ref<UserSecurity | null>(null);
const currentPassword = ref("");
const newPassword = ref("");
const newPasswordConfirmation = ref("");
const isLoading = ref(false);
const isSaving = ref(false);
const isPasswordSaving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const passwordErrorMessage = ref("");
const passwordSuccessMessage = ref("");
const passwordErrors = ref<FormErrors>({});

function getStoredToken() {
  return (
      localStorage.getItem("token") ??
      localStorage.getItem("authToken") ??
      localStorage.getItem("supmealToken") ??
      localStorage.getItem("supmeal_token") ??
      ""
  );
}

function fillForm(user: User) {
  const preferences = user.dietaryPreferences as {
    diet?: string;
    allergies?: string[];
    favoriteCuisine?: string;
  };

  displayName.value = user.displayName;
  email.value = user.email;
  defaultPortions.value = user.defaultPortions;
  diet.value = preferences?.diet ?? "";
  favoriteCuisine.value = preferences?.favoriteCuisine ?? "";
  allergiesText.value = preferences?.allergies?.join(", ") ?? "";
}

function applyFieldErrors(fieldErrors: FieldErrors) {
  const nextErrors: FormErrors = {};

  Object.entries(fieldErrors).forEach(([field, messages]) => {
    if (messages?.[0]) {
      nextErrors[field] = messages[0];
    }
  });

  passwordErrors.value = nextErrors;
}

function parseAllergies() {
  return allergiesText.value
      .split(",")
      .map((allergy) => allergy.trim())
      .filter(Boolean);
}

function resetPasswordForm() {
  currentPassword.value = "";
  newPassword.value = "";
  newPasswordConfirmation.value = "";
  passwordErrors.value = {};
}

async function loadSettings() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  passwordErrorMessage.value = "";
  passwordSuccessMessage.value = "";

  try {
    const [preferencesResponse, securityResponse] = await Promise.all([
      getUserPreferences(token),
      getUserSecurity(token)
    ]);

    fillForm(preferencesResponse.user);
    security.value = securityResponse.security;
    emit("updated", preferencesResponse.user);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de charger les paramètres";
  } finally {
    isLoading.value = false;
  }
}

async function submitSettings() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  if (!displayName.value.trim()) {
    errorMessage.value = "Le pseudonyme est obligatoire";
    return;
  }

  if (Number(defaultPortions.value) < 1) {
    errorMessage.value = "Le nombre de portions doit être supérieur à 0";
    return;
  }

  isSaving.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const response = await updateUserPreferences(token, {
      displayName: displayName.value.trim(),
      defaultPortions: Number(defaultPortions.value),
      dietaryPreferences: {
        diet: diet.value.trim(),
        favoriteCuisine: favoriteCuisine.value.trim(),
        allergies: parseAllergies()
      }
    });

    fillForm(response.user);
    emit("updated", response.user);
    successMessage.value = "Paramètres enregistrés";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible d'enregistrer les paramètres";
  } finally {
    isSaving.value = false;
  }
}

async function submitPassword() {
  const token = getStoredToken();

  if (!token) {
    passwordErrorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  passwordErrors.value = {};
  passwordErrorMessage.value = "";
  passwordSuccessMessage.value = "";

  if (!currentPassword.value) {
    passwordErrors.value.currentPassword = "Le mot de passe actuel est obligatoire";
  }

  if (newPassword.value.length < 8) {
    passwordErrors.value.newPassword = "Le nouveau mot de passe doit contenir au moins 8 caractères";
  }

  if (newPassword.value !== newPasswordConfirmation.value) {
    passwordErrors.value.newPasswordConfirmation = "Les mots de passe ne correspondent pas";
  }

  if (Object.keys(passwordErrors.value).length) {
    return;
  }

  isPasswordSaving.value = true;

  try {
    const response = await changePassword(token, {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      newPasswordConfirmation: newPasswordConfirmation.value
    });

    resetPasswordForm();
    passwordSuccessMessage.value = response.message;
  } catch (error) {
    if (error instanceof ApiError) {
      applyFieldErrors(error.fieldErrors);

      if (!Object.keys(error.fieldErrors).length) {
        passwordErrorMessage.value = error.message;
      }
    } else {
      passwordErrorMessage.value = "Impossible de modifier le mot de passe";
    }
  } finally {
    isPasswordSaving.value = false;
  }
}

onMounted(loadSettings);
</script>

<template>
  <section class="settings-panel">
    <div class="settings-header">
      <div>
        <p class="section-label">Paramètres</p>
        <h2>Compte et préférences</h2>
      </div>
    </div>

    <p v-if="isLoading" class="settings-info">
      Chargement des paramètres...
    </p>

    <div v-else class="settings-content">
      <section class="settings-card">
        <div>
          <p class="section-label">Compte</p>
          <h3>Informations de connexion</h3>
        </div>

        <div class="settings-form">
          <label>
            Email
            <input v-model="email" type="email" disabled>
          </label>

          <p v-if="security && !security.canChangePassword" class="settings-warning">
            Ce compte utilise une connexion OAuth2. L'email et le mot de passe sont gérés par le fournisseur externe.
          </p>
        </div>
      </section>

      <section class="settings-card">
        <div>
          <p class="section-label">Sécurité</p>
          <h3>Mot de passe</h3>
        </div>

        <form v-if="security?.canChangePassword" class="settings-form" @submit.prevent="submitPassword">
          <label>
            Mot de passe actuel
            <input v-model="currentPassword" type="password" placeholder="Votre mot de passe actuel">
            <span v-if="passwordErrors.currentPassword" class="field-error">{{ passwordErrors.currentPassword }}</span>
          </label>

          <label>
            Nouveau mot de passe
            <input v-model="newPassword" type="password" placeholder="Minimum 8 caractères">
            <span v-if="passwordErrors.newPassword" class="field-error">{{ passwordErrors.newPassword }}</span>
          </label>

          <label>
            Confirmation du nouveau mot de passe
            <input v-model="newPasswordConfirmation" type="password" placeholder="Confirmez le nouveau mot de passe">
            <span v-if="passwordErrors.newPasswordConfirmation" class="field-error">{{ passwordErrors.newPasswordConfirmation }}</span>
          </label>

          <p v-if="passwordErrorMessage" class="settings-error">
            {{ passwordErrorMessage }}
          </p>

          <p v-if="passwordSuccessMessage" class="settings-success">
            {{ passwordSuccessMessage }}
          </p>

          <button type="submit" :disabled="isPasswordSaving">
            {{ isPasswordSaving ? "Modification..." : "Modifier le mot de passe" }}
          </button>
        </form>

        <p v-else class="settings-info">
          Le changement de mot de passe n'est pas disponible pour ce compte.
        </p>
      </section>

      <DataImportExportPanel />

      <section class="settings-card">
        <div>
          <p class="section-label">Préférences culinaires</p>
          <h3>Profil utilisateur</h3>
        </div>

        <form class="settings-form" @submit.prevent="submitSettings">
          <label>
            Pseudonyme
            <input v-model="displayName" type="text" placeholder="Votre pseudonyme">
          </label>

          <label>
            Portions par défaut
            <input v-model="defaultPortions" type="number" min="1" max="20">
          </label>

          <label>
            Régime alimentaire
            <input v-model="diet" type="text" placeholder="Ex : équilibré, végétarien, protéiné">
          </label>

          <label>
            Cuisine préférée
            <input v-model="favoriteCuisine" type="text" placeholder="Ex : italienne, asiatique, française">
          </label>

          <label>
            Allergies
            <input v-model="allergiesText" type="text" placeholder="Ex : arachides, lactose, gluten">
          </label>

          <p v-if="errorMessage" class="settings-error">
            {{ errorMessage }}
          </p>

          <p v-if="successMessage" class="settings-success">
            {{ successMessage }}
          </p>

          <button type="submit" :disabled="isSaving">
            {{ isSaving ? "Enregistrement..." : "Enregistrer les préférences" }}
          </button>
        </form>
      </section>
    </div>
  </section>
</template>

<style scoped>
.settings-panel {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  display: grid;
  gap: 20px;
}

.settings-header,
.settings-card {
  background: #fffdf8;
  border: 1px solid #decab0;
  border-radius: 26px;
  padding: 24px;
  box-shadow: 0 18px 50px rgba(44, 32, 24, 0.09);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.settings-content {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  align-items: start;
}

.settings-card {
  display: grid;
  gap: 16px;
}

.section-label {
  margin: 0 0 4px;
  color: #ea580c;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 12px;
}

.settings-header h2,
.settings-card h3 {
  margin: 0;
}

.settings-form {
  display: grid;
  gap: 14px;
}

.settings-form label {
  display: grid;
  gap: 7px;
  color: #2f241d;
  font-weight: 900;
}

.settings-form input {
  border: 1px solid #d9c7b2;
  border-radius: 15px;
  padding: 12px 14px;
  background: #fffdf8;
  color: #2f241d;
  font: inherit;
}

.settings-form input:focus {
  outline: none;
  border-color: #d97706;
  box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.13);
}

.settings-form input:disabled {
  background: #f8efe4;
  color: #5f5148;
}

.settings-form button,
.secondary-button {
  border: 0;
  border-radius: 15px;
  padding: 12px 16px;
  font-weight: 900;
  cursor: pointer;
  background: #f97316;
  color: white;
}

.secondary-button {
  background: #f2ebe3;
  color: #2f241d;
  box-shadow: none;
}

.field-error {
  color: #b91c1c;
  font-size: 13px;
  font-weight: 900;
}

.settings-error,
.settings-warning,
.settings-success {
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  font-weight: 800;
}

.settings-error {
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #991b1b;
}

.settings-warning {
  border: 1px solid #fde68a;
  background: #fffbeb;
  color: #92400e;
}

.settings-success {
  border: 1px solid #bbf7d0;
  background: #ecfdf5;
  color: #047857;
}

.settings-info {
  margin: 0;
  color: #5f5148;
  font-weight: 800;
}

:deep(.data-panel) {
  border: 1px solid #decab0;
  border-radius: 26px;
  background: #fffdf8;
  padding: 24px;
  box-shadow: 0 18px 50px rgba(44, 32, 24, 0.09);
}

:deep(.data-actions button) {
  padding: 12px 16px;
  border-radius: 15px;
}

@media (max-width: 1100px) {
  .settings-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .settings-header {
    flex-direction: column;
  }

  .settings-header,
  .settings-card,
  :deep(.data-panel) {
    padding: 20px;
  }
}
</style>