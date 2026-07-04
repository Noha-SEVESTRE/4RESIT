<script setup lang="ts">
</script>

<template>
  <main class="app">
    <section class="hero">
      <p class="eyebrow">SUPMEAL Pro</p>
      <h1>Organisez vos recettes et vos repas simplement</h1>
      <p class="description">
        SUPMEAL permet de gérer ses recettes, créer des cookbooks partagés et préparer ses repas de la semaine.
      </p>
      <div class="actions">
        <button>Commencer</button>
        <button class="secondary">Voir les recettes</button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: #f8f3ea;
  color: #2f241d;
}

.hero {
  width: 100%;
  max-width: 760px;
  padding: 48px;
  border-radius: 28px;
  background: #fffaf2;
  box-shadow: 0 24px 80px rgba(47, 36, 29, 0.12);
}

.eyebrow {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 700;
  color: #d97706;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  max-width: 680px;
  font-size: 48px;
  line-height: 1.05;
}

.description {
  max-width: 560px;
  margin: 20px 0 0;
  font-size: 18px;
  line-height: 1.6;
  color: #6b5f55;
}

.actions {
  display: flex;
  gap: 14px;
  margin-top: 32px;
}

button {
  border: 0;
  border-radius: 999px;
  padding: 13px 22px;
  background: #d97706;
  color: white;
  font-weight: 700;
  cursor: pointer;
}

button.secondary {
  background: #efe3d0;
  color: #2f241d;
}
</style>