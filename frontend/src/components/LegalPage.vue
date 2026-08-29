<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  type: "privacy" | "terms";
}>();

const emit = defineEmits<{
  back: [];
}>();

const isPrivacy = computed(
    () => props.type === "privacy"
);
</script>

<template>
  <section class="legal-page">
    <div class="legal-header">
      <div>
        <p class="section-label">
          Informations légales
        </p>

        <h2>
          {{
            isPrivacy
                ? "Politique de confidentialité"
                : "Conditions d'utilisation"
          }}
        </h2>

        <p class="legal-date">
          Dernière mise à jour :
          29 août 2026
        </p>
      </div>

      <button
          class="secondary-button"
          type="button"
          @click="emit('back')"
      >
        Retour aux paramètres
      </button>
    </div>

    <!-- POLITIQUE DE CONFIDENTIALITÉ -->
    <article
        v-if="isPrivacy"
        class="legal-content"
    >
      <section>
        <h3>1. Objet</h3>

        <p>
          Cette politique explique quelles données sont
          utilisées par SUPMEAL et dans quel but.
          SUPMEAL est une application de gestion de
          recettes et de planification de repas..
        </p>
      </section>

      <section>
        <h3>2. Données utilisées</h3>

        <p>
          L'application peut enregistrer les informations
          du compte utilisateur, notamment l'adresse email,
          le pseudonyme, les préférences culinaires et les
          paramètres de sécurité nécessaires au
          fonctionnement du service.
        </p>

        <p>
          Les recettes, ingrédients, étapes, tags,
          favoris, plannings, commentaires, messages
          et appartenances aux cookbooks sont également
          enregistrés afin de fournir les fonctionnalités
          demandées par l'utilisateur.
        </p>
      </section>

      <section>
        <h3>3. Authentification</h3>

        <p>
          Un compte peut être utilisé avec une adresse
          email et un mot de passe ou avec un fournisseur
          OAuth2 compatible. Les mots de passe locaux
          sont stockés sous forme hachée et ne sont pas
          conservés en clair.
        </p>
      </section>

      <section>
        <h3>4. Finalités</h3>

        <p>
          Les données sont utilisées uniquement pour
          permettre l'authentification, la gestion des
          recettes, les cookbooks partagés, la
          planification des repas, les commentaires,
          la messagerie et les préférences utilisateur.
        </p>
      </section>

      <section>
        <h3>5. Partage des données</h3>

        <p>
          Les informations d'un cookbook peuvent être
          visibles par les membres autorisés de ce
          cookbook selon leur rôle. SUPMEAL ne prévoit
          pas la vente des données personnelles à des
          tiers.
        </p>
      </section>

      <section>
        <h3>6. Sécurité</h3>

        <p>
          L'application utilise notamment le hachage
          des mots de passe, des jetons
          d'authentification, des contrôles de
          permissions côté serveur et des jetons
          temporaires pour la réinitialisation d'un
          mot de passe.
        </p>
      </section>

      <section>
        <h3>
          7. Conservation et suppression
        </h3>

        <p>
          Les données sont conservées tant que le
          compte et les contenus associés sont
          nécessaires au fonctionnement de
          l'application. Les données supprimées depuis
          l'application sont retirées de la base selon
          les relations prévues par le modèle de
          données.
        </p>
      </section>

      <section>
        <h3>8. Contact</h3>

        <p>
          Toute demande concernant les données doit
          être adressée à l'administrateur de
          l'instance SUPMEAL par mail : noha.sevestre@supinfo.com.
        </p>
      </section>
    </article>

    <!-- CONDITIONS D'UTILISATION -->
    <article
        v-else
        class="legal-content"
    >
      <section>
        <h3>1. Objet</h3>

        <p>
          Les présentes conditions définissent les
          règles d'utilisation de SUPMEAL, application
          de gestion de recettes, de cookbooks et de
          planification de repas..
        </p>
      </section>

      <section>
        <h3>2. Compte utilisateur</h3>

        <p>
          L'utilisateur est responsable des
          informations associées à son compte et doit
          préserver la confidentialité de ses moyens
          d'authentification. Il s'engage à utiliser
          une adresse email lui appartenant et à ne
          pas tenter d'accéder au compte d'un autre
          utilisateur.
        </p>
      </section>

      <section>
        <h3>
          3. Utilisation des fonctionnalités
        </h3>

        <p>
          SUPMEAL permet notamment de créer des
          recettes, rejoindre des cookbooks,
          planifier des repas, ajouter des
          commentaires et échanger avec les autres
          membres autorisés.
        </p>

        <p>
          L'utilisateur s'engage à ne pas détourner
          ces fonctionnalités pour publier des
          contenus illicites, malveillants ou portant
          atteinte aux autres utilisateurs.
        </p>
      </section>

      <section>
        <h3>4. Contenus publiés</h3>

        <p>
          L'utilisateur reste responsable des
          recettes, images, commentaires et messages
          qu'il ajoute dans l'application. Les
          contenus partagés dans un cookbook peuvent
          être consultés par les autres membres selon
          leurs permissions.
        </p>
      </section>

      <section>
        <h3>5. Disponibilité</h3>

        <p>
          Une disponibilité permanente
          du service n'est pas garantie, notamment
          lors des opérations de maintenance, de mise
          à jour ou de déploiement.
        </p>
      </section>

      <section>
        <h3>6. Sécurité et abus</h3>

        <p>
          Toute tentative de contournement des
          permissions, d'accès non autorisé,
          d'altération des données ou de perturbation
          volontaire du service est interdite.
        </p>
      </section>

      <section>
        <h3>
          7. Évolution des conditions
        </h3>

        <p>
          Ces conditions peuvent évoluer avec les
          fonctionnalités de l'application. La date
          de dernière mise à jour affichée sur cette
          page permet d'identifier la version
          applicable.
        </p>
      </section>
    </article>
  </section>
</template>

<style scoped>
.legal-page {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  display: grid;
  gap: 20px;
}

.legal-header,
.legal-content {
  background: #fffdf8;
  border: 1px solid #decab0;
  border-radius: 26px;
  padding: 24px;
  box-shadow:
      0 18px 50px rgba(44, 32, 24, 0.09);
}

.legal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.section-label {
  margin: 0 0 4px;
  color: #ea580c;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 12px;
}

.legal-header h2,
.legal-content h3 {
  margin-top: 0;
}

.legal-date {
  margin: 8px 0 0;
  color: #6b5f55;
  font-weight: 700;
}

.legal-content {
  display: grid;
  gap: 22px;
}

.legal-content section {
  display: grid;
  gap: 8px;
}

.legal-content h3 {
  color: #2f241d;
  font-size: 18px;
}

.legal-content p {
  margin: 0;
  color: #5f5148;
  line-height: 1.7;
}

.secondary-button {
  border: 0;
  border-radius: 15px;
  padding: 12px 16px;
  background: #f2ebe3;
  color: #2f241d;
  box-shadow: none;
  font-weight: 900;
  cursor: pointer;
}

@media (max-width: 800px) {
  .legal-header {
    flex-direction: column;
  }
}
</style>