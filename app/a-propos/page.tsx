import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Financial Dojo",
  description: "Discover the history and mission of the Financial Dojo",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-8">
          À propos du Dojo Financier
        </h1>
        
        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed space-y-6">
          <p>
            Le Dojo Financier est une petite équipe de professionnels du placement, de traders et de nerds de l'investissement qui ont œuvré en gestion d'actifs et planification financière.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">Notre fondateur</h2>
          <p>
            L'équipe est dirigée par moi: Miguel Romain. Mon parcours est quelque peu éclectique et inhabituel et je ne vous ennuierai pas avec les détails de mes péripéties professionnelles, mais j'ai commencé ma carrière dans la gestion d'actifs dans l'une des grandes banques canadiennes, en gérant des portefeuilles pour des personnes à valeur nette élevée.
          </p>

          <p>
            Voyant que le domaine de la finance était extrêmement compétitif, j'ai décidé de collectionner les titres professionnels. Mon objectif était de devenir analyste financier agréé (CFA) et comptable professionnel agréé (CPA). Comme j'avais déjà un bac en finance et que j'étais en voie d'obtenir le CFA, je suis retourné à l'université pour faire un bac en comptabilité afin d'obtenir le titre de CPA (à l'époque, on l'appelait CA).
          </p>

          <p>
            J'ai obtenu le titre de CFA ainsi que le diplôme de comptabilité, mais j'ai abandonné le programme de CPA assez rapidement lorsque j'ai goûté pour la première fois à un emploi de comptable. En effet, après avoir travaillé dans le domaine dynamique de la gestion d'actifs, le travail de moine qu'est la comptabilité et la vérification n'étaient tout simplement pas assez excitants pour moi.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">Le parcours</h2>
          <p>
            Plein de confiance et d'énergie, j'ai alors décidé de tenter ma chance dans le trading en bourse. Je me suis lancé directement dans le trading d'options et j'ai pris une débarque monumentale assez rapidement. Prendre une méga-claque en bourse (ou dans n'importe quel domaine) est une excellente expérience d'apprentissage et je recommande à tout le monde de subir la brûlure de l'échec au moins une fois dans sa vie!
          </p>

          <p>
            Ma courbe d'apprentissage du trading et des options est rapide et quelques années plus tard je navigue les marchés assez confortablement. En principe je vis la dolce vita mais la vie en tant que trader est très solitaire. J'ai toujours pensé que j'étais un loup solitaire qui n'avait pas besoin d'interactions humaines quotidiennes mais il s'avère que je suis un animal social après tout...
          </p>

          <p>
            Pour satisfaire mon désir de communiquer avec d'autres humains dans un contexte quasi professionnel, j'ai décidé d'aider les étudiants en finance de l'université en leur offrant du tutorat. J'ai tout de suite adoré mon expérience et j'ai réalisé que je pouvais apprendre beaucoup en enseignant. J'ai appris non seulement sur la finance et le placement, mais surtout sur la psychologie humaine et sur la façon dont les gens apprennent.
          </p>

          <p>
            C'est là que, avec un associé, j'ai créé ma première entreprise d'enseignement, que j'opère encore aujourd'hui. Nous avons aidé des milliers d'étudiants à réussir leurs examens, que ce soit à l'université ou dans le cadre d'examens professionnels. Nous avons embauché des dizaines de tuteurs et j'ai continué à coacher certains cours de finance.
          </p>

          <p>
            Cette expérience entrepreneuriale m'a amené à créer d'autres entreprises dans le domaine de l'éducation, du marketing et du commerce électronique, tout en continuant à enseigner le placement à des particuliers et à des groupes.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">Notre mission</h2>
          <p>
            Après quelques années, j'ai réalisé qu'il y avait un fossé entre la finance et l'investissement dans la "vraie vie" et la théorie enseignée aux étudiants à l'école. En même temps, j'ai été consterné par le niveau lamentable de l'éducation financière au Québec et au Canada, même parmi les gens instruits.
          </p>

          <p>
            Un peu comme le domaine de la nutrition, la finance est un sujet qui touche tout le monde dans la société. Tous ont besoin d'argent pour acheter une maison, une voiture ou pour prendre leur retraite, il y a donc (ou devrait y avoir) une forte incitation à être aussi futé que possible avec l'argent. Pourtant, la plupart des gens n'ont ni plan financier, ni connaissances rudimentaires sur la manière de gérer leurs finances.
          </p>

          <p>
            En examinant les ressources disponibles en ligne sur la gestion financière, je me suis rendu compte que la plupart d'entre elles appartenaient à l'une des trois catégories suivantes.
          </p>

          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Les institutions financières qui fournissent des informations dans le but d'attirer la clientèle (en gros, des pitch de vente pour leurs produits et services).</li>
            <li>Blogs ou sites individuels pseudo-charlataniques vantant un style ou une stratégie d'investissement spécifique (y compris les programmes "get-rich-quick" ou les formations qui exagèrent les rendements potentiels ou minimisent les risques).</li>
            <li>Sites et bases de données fournissant des informations pertinentes et vérifiables, mais organisées de manière à n'être utiles qu'aux professionnels de la finance et aux personnes qui savent exactement ce qu'elles recherchent.</li>
          </ul>

          <p className="mt-6 font-semibold">
            D'où l'idée de fonder le Dojo Financier. L'objectif est de fournir de l'éducation financière non seulement aux professionnels de la finance mais aussi au commun des mortels. Nous espérons accroître le niveau de littératie financière et, plus important encore, permettre aux gens de prendre le contrôle de leurs finances.
          </p>
        </div>
      </div>
    </div>
  );
}











