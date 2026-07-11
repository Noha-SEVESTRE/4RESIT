<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ApiError, getCurrentUser, loginUser, registerUser, type FieldErrors, type User } from "./services/authService";
import RecipeList from "./components/RecipeList.vue";
import RecipeForm from "./components/RecipeForm.vue";
import type { Recipe } from "./services/recipeService";
import MealPlanPanel from "./components/MealPlanPanel.vue";

type ViewName = "login" | "register" | "dashboard";
type FormErrors = Record<string, string>;

const currentView = ref<ViewName>("login");
const currentUser = ref<User | null>(null);
const token = ref(localStorage.getItem("supmeal_token"));
const isLoading = ref(false);
const errorMessage = ref("");
const infoMessage = ref("");
const loginErrors = ref<FormErrors>({});
const registerErrors = ref<FormErrors>({});
const showRecipeForm = ref(false);
const recipeListKey = ref(0);
const selectedRecipe = ref<Recipe | null>(null);

const loginForm = ref({
  email: "",
  password: ""
});

const registerForm = ref({
  displayName: "",
  email: "",
  password: "",
  passwordConfirmation: ""
});

const stats = [
  {
    label: "Recettes",
    value: "24",
    detail: "Recettes personnelles"
  },
  {
    label: "Cookbooks",
    value: "3",
    detail: "Espaces partagés"
  },
  {
    label: "Repas planifiés",
    value: "12",
    detail: "Cette semaine"
  }
];

function resetMessages() {
  errorMessage.value = "";
  infoMessage.value = "";
  loginErrors.value = {};
  registerErrors.value = {};
}

function saveSession(nextToken: string, user: User) {
  token.value = nextToken;
  currentUser.value = user;
  localStorage.setItem("supmeal_token", nextToken);
  currentView.value = "dashboard";
}

function goToLogin() {
  resetMessages();
  currentView.value = "login";
}

function goToRegister() {
  resetMessages();
  currentView.value = "register";
}

function logout() {
  token.value = null;
  currentUser.value = null;
  localStorage.removeItem("supmeal_token");
  goToLogin();
}

function showOAuthMessage(provider: string) {
  resetMessages();
  infoMessage.value = `La connexion ${provider} sera ajoutée dans une prochaine étape.`;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function applyFieldErrors(target: typeof loginErrors, fieldErrors: FieldErrors) {
  const nextErrors: FormErrors = {};

  Object.entries(fieldErrors).forEach(([field, messages]) => {
    if (messages?.[0]) {
      nextErrors[field] = messages[0];
    }
  });

  target.value = nextErrors;
}

function validateLogin() {
  const errors: FormErrors = {};
  const email = loginForm.value.email.trim();

  if (!email) {
    errors.email = "L'adresse email est obligatoire";
  } else if (!isValidEmail(email)) {
    errors.email = "L'adresse email n'est pas valide";
  }

  if (!loginForm.value.password) {
    errors.password = "Le mot de passe est obligatoire";
  }

  loginErrors.value = errors;

  return Object.keys(errors).length === 0;
}

function validateRegister() {
  const errors: FormErrors = {};
  const displayName = registerForm.value.displayName.trim();
  const email = registerForm.value.email.trim();

  if (!displayName) {
    errors.displayName = "Le pseudonyme est obligatoire";
  } else if (displayName.length < 2) {
    errors.displayName = "Le pseudonyme doit contenir au moins 2 caractères";
  }

  if (!email) {
    errors.email = "L'adresse email est obligatoire";
  } else if (!isValidEmail(email)) {
    errors.email = "L'adresse email n'est pas valide";
  }

  if (!registerForm.value.password) {
    errors.password = "Le mot de passe est obligatoire";
  } else if (registerForm.value.password.length < 8) {
    errors.password = "Le mot de passe doit contenir au moins 8 caractères";
  }

  if (!registerForm.value.passwordConfirmation) {
    errors.passwordConfirmation = "La confirmation du mot de passe est obligatoire";
  } else if (registerForm.value.password !== registerForm.value.passwordConfirmation) {
    errors.passwordConfirmation = "Les mots de passe ne correspondent pas";
  }

  registerErrors.value = errors;

  return Object.keys(errors).length === 0;
}

function handleRecipeSaved() {
  showRecipeForm.value = false;
  selectedRecipe.value = null;
  recipeListKey.value++;
}

function openRecipeForm(recipe: Recipe | null = null) {
  selectedRecipe.value = recipe;
  showRecipeForm.value = true;
}

async function submitLogin() {
  try {
    resetMessages();

    if (!validateLogin()) {
      return;
    }

    isLoading.value = true;

    const response = await loginUser(
        loginForm.value.email.trim(),
        loginForm.value.password
    );

    saveSession(response.token, response.user);
  } catch (error) {
    if (error instanceof ApiError) {
      applyFieldErrors(loginErrors, error.fieldErrors);

      if (!Object.keys(error.fieldErrors).length) {
        errorMessage.value = error.message;
      }
    } else {
      errorMessage.value = "Connexion impossible pour le moment";
    }
  } finally {
    isLoading.value = false;
  }
}

async function submitRegister() {
  try {
    resetMessages();

    if (!validateRegister()) {
      return;
    }

    isLoading.value = true;

    const response = await registerUser(
        registerForm.value.displayName.trim(),
        registerForm.value.email.trim(),
        registerForm.value.password
    );

    saveSession(response.token, response.user);
  } catch (error) {
    if (error instanceof ApiError) {
      applyFieldErrors(registerErrors, error.fieldErrors);

      if (!Object.keys(error.fieldErrors).length) {
        errorMessage.value = error.message;
      }
    } else {
      errorMessage.value = "Inscription impossible pour le moment";
    }
  } finally {
    isLoading.value = false;
  }
}

onMounted(async () => {
  if (!token.value) {
    return;
  }

  try {
    const response = await getCurrentUser(token.value);

    currentUser.value = response.user;
    currentView.value = "dashboard";
  } catch (_error) {
    localStorage.removeItem("supmeal_token");
    token.value = null;
    currentView.value = "login";
  }
});
</script>

<template>
  <main v-if="currentView === 'login'" class="auth-page">
    <section class="auth-card">
      <div>
        <p class="eyebrow">SUPMEAL Pro</p>
        <h1>Connexion</h1>
        <p class="auth-description">
          Connectez-vous pour retrouver vos recettes, vos cookbooks et votre planning de repas.
        </p>
      </div>

      <form class="auth-form" @submit.prevent="submitLogin">
        <label>
          Email
          <input v-model="loginForm.email" :class="{ 'input-error': loginErrors.email }" type="email" placeholder="user@gmail.fr">
          <span v-if="loginErrors.email" class="field-error">{{ loginErrors.email }}</span>
        </label>

        <label>
          Mot de passe
          <input v-model="loginForm.password" :class="{ 'input-error': loginErrors.password }" type="password" placeholder="Votre mot de passe">
          <span v-if="loginErrors.password" class="field-error">{{ loginErrors.password }}</span>
        </label>

        <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>
        <p v-if="infoMessage" class="auth-info">{{ infoMessage }}</p>

        <button type="submit" :disabled="isLoading">
          {{ isLoading ? "Connexion..." : "Se connecter" }}
        </button>
      </form>

      <div class="oauth-section">
        <div class="separator">
          <span></span>
          <p>ou continuer avec</p>
          <span></span>
        </div>

        <div class="oauth-buttons">
          <button class="oauth-button" type="button" @click="showOAuthMessage('Google')">
            Google
          </button>
          <button class="oauth-button" type="button" @click="showOAuthMessage('GitHub')">
            GitHub
          </button>
        </div>
      </div>

      <p class="auth-switch">
        Pas encore de compte ?
        <button type="button" @click="goToRegister">Créer un compte</button>
      </p>
    </section>
  </main>

  <main v-else-if="currentView === 'register'" class="auth-page">
    <section class="auth-card">
      <div>
        <p class="eyebrow">SUPMEAL Pro</p>
        <h1>Inscription</h1>
        <p class="auth-description">
          Créez votre compte pour organiser vos recettes personnelles et vos repas de la semaine.
        </p>
      </div>

      <form class="auth-form" @submit.prevent="submitRegister">
        <label>
          Pseudonyme
          <input v-model="registerForm.displayName" :class="{ 'input-error': registerErrors.displayName }" type="text" placeholder="Pseudonyme">
          <span v-if="registerErrors.displayName" class="field-error">{{ registerErrors.displayName }}</span>
        </label>

        <label>
          Email
          <input v-model="registerForm.email" :class="{ 'input-error': registerErrors.email }" type="email" placeholder="user@gmail.com">
          <span v-if="registerErrors.email" class="field-error">{{ registerErrors.email }}</span>
        </label>

        <label>
          Mot de passe
          <input v-model="registerForm.password" :class="{ 'input-error': registerErrors.password }" type="password" placeholder="Minimum 8 caractères">
          <span v-if="registerErrors.password" class="field-error">{{ registerErrors.password }}</span>
        </label>

        <label>
          Confirmation du mot de passe
          <input v-model="registerForm.passwordConfirmation" :class="{ 'input-error': registerErrors.passwordConfirmation }" type="password" placeholder="Confirmez votre mot de passe">
          <span v-if="registerErrors.passwordConfirmation" class="field-error">{{ registerErrors.passwordConfirmation }}</span>
        </label>

        <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>

        <button type="submit" :disabled="isLoading">
          {{ isLoading ? "Création..." : "Créer mon compte" }}
        </button>
      </form>

      <p class="auth-switch">
        Déjà inscrit ?
        <button type="button" @click="goToLogin">Se connecter</button>
      </p>
    </section>
  </main>

  <div v-else class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-icon">S</div>
        <div>
          <p>SUPMEAL</p>
          <span>Meal planner</span>
        </div>
      </div>

      <nav class="navigation">
        <a class="active" href="#">Tableau de bord</a>
        <a href="#">Recettes</a>
        <a href="#">Cookbooks</a>
        <a href="#">Planning</a>
        <a href="#">Paramètres</a>
      </nav>

      <button class="logout-button" type="button" @click="logout">
        Déconnexion
      </button>
    </aside>

    <main class="content">
      <header class="topbar">
        <div>
          <p class="eyebrow">SUPMEAL Pro</p>
          <h1>Bienvenue sur votre espace recettes</h1>
          <p v-if="currentUser" class="user-badge">
            Connecté en tant que {{ currentUser.displayName }}
          </p>
        </div>
        <button type="button" @click="openRecipeForm()">Nouvelle recette</button>
      </header>

      <section class="hero-card">
        <div>
          <p class="eyebrow">Organisation culinaire</p>
          <h2>Planifiez vos repas et partagez vos recettes facilement.</h2>
          <p>
            Gérez vos recettes personnelles, créez des cookbooks collaboratifs et préparez vos menus de la semaine depuis une seule interface.
          </p>
        </div>
      </section>

      <section class="stats-grid">
        <article v-for="stat in stats" :key="stat.label" class="stat-card">
          <span>{{ stat.label }}</span>
          <strong>{{ stat.value }}</strong>
          <p>{{ stat.detail }}</p>
        </article>
      </section>

      <RecipeForm
          v-if="showRecipeForm"
          :recipe="selectedRecipe"
          @saved="handleRecipeSaved"
          @cancelled="showRecipeForm = false"
      />

      <RecipeList :key="recipeListKey" @edit="openRecipeForm" />

      <section class="dashboard-grid">
        <MealPlanPanel :key="recipeListKey" />
      </section>
    </main>
  </div>
</template>