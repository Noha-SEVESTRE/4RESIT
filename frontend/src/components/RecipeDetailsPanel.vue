<script setup lang="ts">
import { computed } from "vue";
import type { Recipe } from "../services/recipeService";

const props = defineProps<{
  recipe: Recipe;
}>();

const emit = defineEmits<{
  close: [];
}>();

const totalTime = computed(() => props.recipe.preparationTime + props.recipe.cookingTime);

const sortedIngredients = computed(() => {
  return [...(props.recipe.ingredients ?? [])].sort((first, second) => first.position - second.position);
});

const sortedSteps = computed(() => {
  return [...(props.recipe.steps ?? [])].sort((first, second) => first.position - second.position);
});

const isExternalSource = computed(() => {
  return props.recipe.source?.startsWith("http://") || props.recipe.source?.startsWith("https://");
});

function formatIngredient(quantity: string | null, unit: string | null, name: string) {
  const amount = [quantity, unit].filter(Boolean).join(" ");

  return amount ? `${name} · ${amount}` : name;
}
</script>

<template>
  <section class="recipe-details-panel">
    <div class="recipe-details-header">
      <div>
        <p class="section-label">Détail recette</p>
        <h2>{{ recipe.title }}</h2>
        <p>{{ recipe.description || "Aucune description renseignée." }}</p>
      </div>

      <button class="secondary-button" type="button" @click="emit('close')">
        Fermer
      </button>
    </div>

    <div class="recipe-details-layout">
      <div class="recipe-details-visual">
        <img
            v-if="recipe.imageUrl"
            :src="recipe.imageUrl"
            :alt="recipe.title"
        >

        <div v-else class="recipe-details-placeholder">
          <span>{{ recipe.title.charAt(0).toUpperCase() }}</span>
          <p>Aucune image</p>
        </div>
      </div>

      <div class="recipe-details-summary">
        <div>
          <span>Préparation</span>
          <strong>{{ recipe.preparationTime }} min</strong>
        </div>

        <div>
          <span>Cuisson</span>
          <strong>{{ recipe.cookingTime }} min</strong>
        </div>

        <div>
          <span>Temps total</span>
          <strong>{{ totalTime }} min</strong>
        </div>

        <div>
          <span>Portions</span>
          <strong>{{ recipe.portions }}</strong>
        </div>
      </div>
    </div>

    <div v-if="recipe.tags?.length" class="recipe-details-tags">
      <span v-for="tag in recipe.tags" :key="tag">
        {{ tag }}
      </span>
    </div>

    <div class="recipe-details-sections">
      <article>
        <h3>Ingrédients</h3>

        <p v-if="!sortedIngredients.length" class="recipe-details-empty">
          Aucun ingrédient renseigné.
        </p>

        <ul v-else>
          <li v-for="ingredient in sortedIngredients" :key="ingredient.id">
            {{ formatIngredient(ingredient.quantity, ingredient.unit, ingredient.name) }}
          </li>
        </ul>
      </article>

      <article>
        <h3>Étapes</h3>

        <p v-if="!sortedSteps.length" class="recipe-details-empty">
          Aucune étape renseignée.
        </p>

        <ol v-else>
          <li v-for="step in sortedSteps" :key="step.id">
            {{ step.instruction }}
          </li>
        </ol>
      </article>
    </div>

    <div class="recipe-details-source">
      <h3>Source</h3>

      <a v-if="recipe.source && isExternalSource" :href="recipe.source" target="_blank" rel="noreferrer">
        {{ recipe.source }}
      </a>

      <p v-else>
        {{ recipe.source || "Création personnelle" }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.recipe-details-panel {
  display: grid;
  gap: 20px;
  padding: 24px;
  border: 1px solid #c9ad8d;
  border-radius: 28px;
  background: #fffaf2;
  box-shadow: 0 22px 65px rgba(44, 32, 24, 0.12);
}

.recipe-details-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  padding-bottom: 18px;
  border-bottom: 1px solid #e2d2bd;
}

.recipe-details-header h2 {
  margin: 0 0 8px;
}

.recipe-details-header p {
  margin: 0;
  color: #5f5148;
  line-height: 1.5;
}

.section-label {
  margin: 0 0 4px;
  color: #ea580c;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 12px;
}

.recipe-details-layout {
  display: grid;
  grid-template-columns: minmax(280px, 1.1fr) minmax(260px, 0.9fr);
  gap: 18px;
  align-items: stretch;
}

.recipe-details-visual {
  min-height: 260px;
  border: 1px solid #decab0;
  border-radius: 22px;
  overflow: hidden;
  background: #f7efe4;
}

.recipe-details-visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.recipe-details-placeholder {
  height: 100%;
  min-height: 260px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  background: linear-gradient(135deg, #fff7ed, #f7efe4);
  color: #8a5a1f;
}

.recipe-details-placeholder span {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  background: #f97316;
  color: white;
  font-size: 26px;
  font-weight: 900;
}

.recipe-details-placeholder p {
  margin: 0;
  font-weight: 900;
}

.recipe-details-summary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.recipe-details-summary div {
  display: grid;
  gap: 6px;
  padding: 16px;
  border: 1px solid #decab0;
  border-radius: 20px;
  background: #fffdf8;
}

.recipe-details-summary span {
  color: #6b5f55;
  font-size: 13px;
  font-weight: 800;
}

.recipe-details-summary strong {
  color: #2f241d;
  font-size: 22px;
}

.recipe-details-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.recipe-details-tags span {
  background: #e8f8ef;
  color: #047857;
  border: 1px solid #bfead2;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 13px;
  font-weight: 900;
}

.recipe-details-sections {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.recipe-details-sections article,
.recipe-details-source {
  padding: 18px;
  border: 1px solid #decab0;
  border-radius: 22px;
  background: #fffdf8;
}

.recipe-details-sections h3,
.recipe-details-source h3 {
  margin: 0 0 12px;
  color: #2f241d;
}

.recipe-details-sections ul,
.recipe-details-sections ol {
  margin: 0;
  padding-left: 22px;
  color: #3b2d24;
  line-height: 1.7;
}

.recipe-details-empty {
  margin: 0;
  color: #6b5f55;
  font-weight: 800;
}

.recipe-details-source p,
.recipe-details-source a {
  margin: 0;
  color: #5f5148;
  font-weight: 800;
  word-break: break-word;
}

.recipe-details-source a {
  color: #c2410c;
}

.secondary-button {
  border: 1px solid #e2d2bd;
  border-radius: 999px;
  padding: 8px 16px;
  min-height: 36px;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
  background: #f2ebe3;
  color: #2f241d;
  box-shadow: none;
}

@media (max-width: 900px) {
  .recipe-details-header,
  .recipe-details-layout,
  .recipe-details-sections {
    grid-template-columns: 1fr;
  }

  .recipe-details-header {
    flex-direction: column;
  }
}
</style>