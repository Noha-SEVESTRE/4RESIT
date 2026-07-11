<script setup lang="ts">
import { ref } from "vue";
import { createRecipe } from "../services/recipeService";

const emit = defineEmits<{
  created: [];
  cancelled: [];
}>();

const title = ref("");
const description = ref("");
const preparationTime = ref(10);
const cookingTime = ref(15);
const portions = ref(2);
const source = ref("Création personnelle");
const ingredientsText = ref("");
const stepsText = ref("");
const tagsText = ref("");
const isLoading = ref(false);
const errorMessage = ref("");

function getStoredToken() {
  return (
      localStorage.getItem("token") ??
      localStorage.getItem("authToken") ??
      localStorage.getItem("supmealToken") ??
      localStorage.getItem("supmeal_token") ??
      ""
  );
}

function parseIngredients() {
  return ingredientsText.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({
        name: line,
        quantity: "",
        unit: ""
      }));
}

function parseSteps() {
  return stepsText.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
}

function parseTags() {
  return tagsText.value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
}

async function submitRecipe() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  const ingredients = parseIngredients();
  const steps = parseSteps();

  if (!title.value.trim()) {
    errorMessage.value = "Le titre est obligatoire";
    return;
  }

  if (!ingredients.length) {
    errorMessage.value = "Ajoute au moins un ingrédient";
    return;
  }

  if (!steps.length) {
    errorMessage.value = "Ajoute au moins une étape";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    await createRecipe(token, {
      title: title.value.trim(),
      description: description.value.trim(),
      preparationTime: Number(preparationTime.value),
      cookingTime: Number(cookingTime.value),
      portions: Number(portions.value),
      imageUrl: "",
      source: source.value.trim(),
      ingredients,
      steps,
      tags: parseTags()
    });

    emit("created");
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de créer la recette";
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <section class="recipe-form-card">
    <div class="recipe-form-header">
      <div>
        <p class="section-label">Nouvelle recette</p>
        <h2>Ajouter une recette</h2>
      </div>

      <button class="secondary-button" type="button" @click="emit('cancelled')">
        Fermer
      </button>
    </div>

    <form class="recipe-form" @submit.prevent="submitRecipe">
      <label>
        Titre
        <input v-model="title" type="text" placeholder="Ex : Poulet citron et riz">
      </label>

      <label>
        Description
        <textarea v-model="description" placeholder="Petite description de la recette"></textarea>
      </label>

      <div class="recipe-form-row">
        <label>
          Préparation
          <input v-model="preparationTime" type="number" min="0">
        </label>

        <label>
          Cuisson
          <input v-model="cookingTime" type="number" min="0">
        </label>

        <label>
          Portions
          <input v-model="portions" type="number" min="1">
        </label>
      </div>

      <label>
        Source
        <input v-model="source" type="text" placeholder="Création personnelle">
      </label>

      <label>
        Ingrédients
        <textarea v-model="ingredientsText" placeholder="Un ingrédient par ligne"></textarea>
      </label>

      <label>
        Étapes
        <textarea v-model="stepsText" placeholder="Une étape par ligne"></textarea>
      </label>

      <label>
        Tags
        <input v-model="tagsText" type="text" placeholder="rapide, protéiné, midi">
      </label>

      <p v-if="errorMessage" class="recipe-error">
        {{ errorMessage }}
      </p>

      <button type="submit" :disabled="isLoading">
        {{ isLoading ? "Création..." : "Créer la recette" }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.recipe-form-card {
  background: white;
  border-radius: 28px;
  padding: 28px;
  box-shadow: 0 20px 60px rgba(44, 32, 24, 0.08);
  display: grid;
  gap: 22px;
}

.recipe-form-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.section-label {
  margin: 0 0 4px;
  color: #f97316;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
}

.recipe-form-header h2 {
  margin: 0;
}

.recipe-form {
  display: grid;
  gap: 16px;
}

.recipe-form label {
  display: grid;
  gap: 8px;
  font-weight: 800;
}

.recipe-form input,
.recipe-form textarea {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 13px 15px;
  font: inherit;
}

.recipe-form textarea {
  min-height: 90px;
  resize: vertical;
}

.recipe-form-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.recipe-form button,
.secondary-button {
  border: 0;
  border-radius: 16px;
  padding: 14px 18px;
  font-weight: 900;
  cursor: pointer;
  background: #f97316;
  color: white;
}

.secondary-button {
  background: #f3f4f6;
  color: #111827;
}

.recipe-error {
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  background: #fff7f7;
  color: #b91c1c;
  font-weight: 700;
}

@media (max-width: 900px) {
  .recipe-form-row {
    grid-template-columns: 1fr;
  }

  .recipe-form-header {
    flex-direction: column;
  }
}
</style>