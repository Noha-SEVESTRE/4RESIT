<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiError, getCurrentUser, loginUser, registerUser, startGitHubLogin, startGoogleLogin, type FieldErrors, type User } from "./services/authService";
import RecipeList from "./components/RecipeList.vue";
import RecipeForm from "./components/RecipeForm.vue";
import type { Recipe } from "./services/recipeService";
import MealPlanPanel from "./components/MealPlanPanel.vue";
import CookbookPanel from "./components/CookbookPanel.vue";
import SettingsPanel from "./components/SettingsPanel.vue";

type ViewName = "login" | "register" | "dashboard";
type PageName = "dashboard" | "recipes" | "planning" | "cookbooks" | "settings";
type FormErrors = Record<string, string>;

const currentView = ref<ViewName>("login");
const currentPage = ref<PageName>("dashboard");
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
    value: "Créer",
    detail: "Ajoutez vos recettes avec ingrédients, étapes, tags et image"
  },
  {
    label: "Cookbooks",
    value: "Partager",
    detail: "Organisez des recettes communes avec des rôles par membre"
  },
  {
    label: "Planning",
    value: "Planifier",
    detail: "Associez vos recettes aux repas de la semaine"
  }
];

const pageTitle = computed(() => {
  if (currentPage.value === "dashboard") {
    return "Bienvenue sur votre espace recettes";
  }

  if (currentPage.value === "recipes") {
    return "Mes recettes";
  }

  if (currentPage.value === "planning") {
    return "Planning des repas";
  }

  if (currentPage.value === "cookbooks") {
    return "Cookbooks partagés";
  }

  return "Paramètres";
});

const pageDescription = computed(() => {
  if (currentPage.value === "dashboard") {
    return "Retrouvez un aperçu rapide de votre espace SUPMEAL.";
  }

  if (currentPage.value === "recipes") {
    return "Créez, recherchez, modifiez et organisez vos recettes personnelles.";
  }

  if (currentPage.value === "planning") {
    return "Planifiez vos recettes sur les différents repas de la semaine.";
  }

  if (currentPage.value === "cookbooks") {
    return "Gérez vos cookbooks, leurs membres et les recettes partagées.";
  }

  return "Gérez les préférences de votre compte.";
});

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
  currentPage.value = "dashboard";
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
  currentPage.value = "dashboard";
  showRecipeForm.value = false;
  selectedRecipe.value = null;
  localStorage.removeItem("supmeal_token");
  goToLogin();
}

function setCurrentPage(page: PageName) {
  currentPage.value = page;

  if (page !== "recipes") {
    closeRecipeForm();
  }
}

function closeRecipeForm() {
  showRecipeForm.value = false;
  selectedRecipe.value = null;
}

function handleRecipeSaved() {
  closeRecipeForm();
  recipeListKey.value++;
}

function openRecipeForm(recipe: Recipe | null = null) {
  currentPage.value = "recipes";
  selectedRecipe.value = recipe;
  showRecipeForm.value = true;
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

function handleUserUpdated(user: User) {
  currentUser.value = user;
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
  const params = new URLSearchParams(window.location.search);
  const oauthToken = params.get("token");
  const oauthStatus = params.get("oauth");

  if (oauthStatus === "missing_email") {
    errorMessage.value = "Votre compte GitHub ne fournit pas d'adresse email vérifiée.";
    currentView.value = "login";
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
  }

  if (oauthStatus === "missing_code") {
    errorMessage.value = "Connexion GitHub interrompue.";
    currentView.value = "login";
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
  }

  if (oauthToken) {
    localStorage.setItem("supmeal_token", oauthToken);
    token.value = oauthToken;
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  if (!token.value) {
    return;
  }

  try {
    const response = await getCurrentUser(token.value);

    currentUser.value = response.user;
    currentView.value = "dashboard";
    currentPage.value = "dashboard";
  } catch (_error) {
    localStorage.removeItem("supmeal_token");
    token.value = null;
    currentView.value = "login";
    currentPage.value = "dashboard";
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
          <button class="oauth-button" type="button" @click="startGoogleLogin">
            Google
          </button>
          <button class="oauth-button" type="button" @click="startGitHubLogin">
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
        <a href="#" :class="{ active: currentPage === 'dashboard' }" @click.prevent="setCurrentPage('dashboard')">
          Tableau de bord
        </a>

        <a href="#" :class="{ active: currentPage === 'recipes' }" @click.prevent="setCurrentPage('recipes')">
          Recettes
        </a>

        <a href="#" :class="{ active: currentPage === 'cookbooks' }" @click.prevent="setCurrentPage('cookbooks')">
          Cookbooks
        </a>

        <a href="#" :class="{ active: currentPage === 'planning' }" @click.prevent="setCurrentPage('planning')">
          Planning
        </a>

        <a href="#" :class="{ active: currentPage === 'settings' }" @click.prevent="setCurrentPage('settings')">
          Paramètres
        </a>
      </nav>

      <button class="logout-button" type="button" @click="logout">
        Déconnexion
      </button>
    </aside>

    <main class="content">
      <header class="topbar">
        <div>
          <p class="eyebrow">SUPMEAL Pro</p>
          <h1>{{ pageTitle }}</h1>
          <p class="user-badge">
            {{ pageDescription }}
          </p>
          <p v-if="currentUser" class="user-badge">
            Connecté en tant que {{ currentUser.displayName }}
          </p>
        </div>

        <button v-if="currentPage === 'recipes'" type="button" @click="openRecipeForm()">
          Nouvelle recette
        </button>
      </header>

      <section v-if="currentPage === 'dashboard'" class="dashboard-home">
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

        <section class="dashboard-grid">
          <article class="panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Recettes</p>
                <h3>Gérer mes recettes</h3>
              </div>
              <a href="#" @click.prevent="setCurrentPage('recipes')">Ouvrir</a>
            </div>
            <p>
              Ajoutez, modifiez, filtrez et organisez vos recettes personnelles.
            </p>
          </article>

          <article class="panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Planning</p>
                <h3>Planifier mes repas</h3>
              </div>
              <a href="#" @click.prevent="setCurrentPage('planning')">Ouvrir</a>
            </div>
            <p>
              Associez vos recettes à des dates et types de repas.
            </p>
          </article>

          <article class="panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Cookbooks</p>
                <h3>Partager des recettes</h3>
              </div>
              <a href="#" @click.prevent="setCurrentPage('cookbooks')">Ouvrir</a>
            </div>
            <p>
              Créez des espaces partagés avec des membres et des rôles.
            </p>
          </article>
          <article class="panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Paramètres</p>
                <h3>Gérer mes données</h3>
              </div>
              <a href="#" @click.prevent="setCurrentPage('settings')">Ouvrir</a>
            </div>
            <p>
              Modifiez vos préférences culinaires et utilisez l'import/export SUPMEAL.
            </p>
          </article>
        </section>
      </section>

      <section v-else-if="currentPage === 'recipes'" class="page-section recipes-page">
        <RecipeForm
            v-if="showRecipeForm"
            :recipe="selectedRecipe"
            @saved="handleRecipeSaved"
            @cancelled="closeRecipeForm"
        />

        <RecipeList :key="recipeListKey" @edit="openRecipeForm" />
      </section>

      <section v-else-if="currentPage === 'planning'" class="page-section planning-page">
        <MealPlanPanel :key="recipeListKey" />
      </section>

      <section v-else-if="currentPage === 'cookbooks'" class="page-section">
        <CookbookPanel :key="recipeListKey" />
      </section>

      <section v-else class="page-section">
        <SettingsPanel @updated="handleUserUpdated" />
      </section>
    </main>
  </div>
</template>