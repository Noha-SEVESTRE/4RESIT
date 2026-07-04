<script setup lang="ts">
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
</script>

<template>
  <div class="app-shell">
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
    </aside>

    <main class="content">
      <header class="topbar">
        <div>
          <p class="eyebrow">SUPMEAL Pro</p>
          <h1>Bienvenue sur votre espace recettes</h1>
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