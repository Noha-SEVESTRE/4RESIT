<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getCurrentUser, loginUser, registerUser, type User } from "./services/authService";

type ViewName = "login" | "register" | "dashboard";

const currentView = ref<ViewName>("login");
const currentUser = ref<User | null>(null);
const token = ref(localStorage.getItem("supmeal_token"));
const isLoading = ref(false);
const errorMessage = ref("");
const infoMessage = ref("");

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
    detail: "6 ajoutées ce mois-ci"
  },
  {
    label: "Cookbooks",
    value: "3",
    detail: "2 partagés"
  },
  {
    label: "Repas planifiés",
    value: "12",
    detail: "Cette semaine"
  }
];

const recipes = [
  {
    title: "Risotto aux champignons",
    tag: "Végétarien",
    time: "35 min"
  },
  {
    title: "Poulet citron et herbes",
    tag: "Protéiné",
    time: "45 min"
  },
  {
    title: "Bowl saumon avocat",
    tag: "Rapide",
    time: "20 min"
  }
];

const meals = [
  {
    day: "Lundi",
    meal: "Risotto aux champignons"
  },
  {
    day: "Mardi",
    meal: "Poulet citron et herbes"
  },
  {
    day: "Mercredi",
    meal: "Bowl saumon avocat"
  }
];

function resetMessages() {
  errorMessage.value = "";
  infoMessage.value = "";
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

async function submitLogin() {
  try {
    resetMessages();
    isLoading.value = true;

    const response = await loginUser(loginForm.value.email, loginForm.value.password);

    saveSession(response.token, response.user);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Connexion impossible";
  } finally {
    isLoading.value = false;
  }
}

async function submitRegister() {
  try {
    resetMessages();

    if (registerForm.value.password !== registerForm.value.passwordConfirmation) {
      errorMessage.value = "Les mots de passe ne correspondent pas";
      return;
    }

    isLoading.value = true;

    const response = await registerUser(
        registerForm.value.displayName,
        registerForm.value.email,
        registerForm.value.password
    );

    saveSession(response.token, response.user);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Inscription impossible";
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
          <input v-model="loginForm.email" type="email" placeholder="test@supmeal.fr">
        </label>

        <label>
          Mot de passe
          <input v-model="loginForm.password" type="password" placeholder="Votre mot de passe">
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
          <button class="oauth-button" type="button">
            Google
          </button>
          <button class="oauth-button" type="button">
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
          <input v-model="registerForm.displayName" type="text" placeholder="Pseudonyme">
        </label>

        <label>
          Email
          <input v-model="registerForm.email" type="email" placeholder="user@gmail.com">
        </label>

        <label>
          Mot de passe
          <input v-model="registerForm.password" type="password" placeholder="Minimum 8 caractères">
        </label>

        <label>
          Confirmation du mot de passe
          <input v-model="registerForm.passwordConfirmation" type="password" placeholder="Confirmez votre mot de passe">
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
        <button>Nouvelle recette</button>
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

      <section class="dashboard-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Recettes</p>
              <h3>Dernières recettes</h3>
            </div>
            <a href="#">Voir tout</a>
          </div>

          <div class="list">
            <div v-for="recipe in recipes" :key="recipe.title" class="list-item">
              <div>
                <strong>{{ recipe.title }}</strong>
                <span>{{ recipe.tag }}</span>
              </div>
              <p>{{ recipe.time }}</p>
            </div>
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Planning</p>
              <h3>Repas prévus</h3>
            </div>
            <a href="#">Modifier</a>
          </div>

          <div class="list">
            <div v-for="meal in meals" :key="meal.day" class="list-item">
              <div>
                <strong>{{ meal.day }}</strong>
                <span>{{ meal.meal }}</span>
              </div>
            </div>
          </div>
        </article>
      </section>
    </main>
  </div>
</template>