const { normalizeQuestionInput } = require("../utils/testBank");

const DEMO_SOURCE = "demo";
const DEMO_SEED_TAG = "student-flow-v1";
const OPTION_IDS = ["a", "b", "c", "d"];

function createQuestion(level, type, prompt, optionTexts, correctOptionId, explanation) {
  return normalizeQuestionInput({
    level,
    type,
    prompt,
    options: optionTexts.map((text, index) => ({
      id: OPTION_IDS[index],
      text,
    })),
    correctOptionId,
    explanation,
    isActive: true,
    source: DEMO_SOURCE,
    seedTag: DEMO_SEED_TAG,
  });
}

const DEMO_QUESTION_BLUEPRINTS = [
  ["B1", "meaning", "The hotel is within walking distance of the old town.", ["easy to reach on foot", "too far to visit", "closed to visitors", "popular with drivers"], "a", "Within walking distance means you can get there by walking."],
  ["B1", "meaning", "Linh felt relieved when she finally submitted the assignment.", ["angry", "worried", "less stressed", "unprepared"], "c", "Relieved means feeling free from worry or stress."],
  ["B1", "meaning", "The museum has a wide range of modern paintings.", ["small price", "large variety", "strict rule", "final decision"], "b", "A wide range is a large variety of something."],
  ["B1", "meaning", "Please handle the glass vase with care.", ["quickly", "carefully", "secretly", "cheaply"], "b", "With care means carefully."],
  ["B1", "meaning", "The coach praised her steady progress in class.", ["slow improvement", "regular improvement", "final mistake", "sudden failure"], "b", "Steady progress means regular, consistent improvement."],
  ["B1", "meaning", "After a short delay, the train left the station.", ["difference in price", "period of waiting", "kind of ticket", "change of platform"], "b", "A delay is a period of waiting later than planned."],
  ["B1", "meaning", "Marco is eager to join the photography club.", ["afraid", "ready and excited", "too busy", "unable"], "b", "Eager means keen or excited to do something."],
  ["B1", "meaning", "The documentary was quite informative.", ["funny", "full of useful facts", "extremely short", "hard to hear"], "b", "Informative means giving useful information."],
  ["B1", "meaning", "Her answer was accurate and easy to understand.", ["correct", "creative", "polite", "surprising"], "a", "Accurate means correct and precise."],
  ["B1", "meaning", "The recipe is simple enough for beginners.", ["difficult", "suitable", "expensive", "unhealthy"], "b", "Simple enough for beginners means suitable for beginners."],

  ["B1", "collocation", "Before the interview, I need to ___ a decision about which job I want.", ["do", "make", "take", "bring"], "b", "We say make a decision."],
  ["B1", "collocation", "Can you ___ attention while the teacher explains the homework?", ["pay", "give", "do", "put"], "a", "The fixed expression is pay attention."],
  ["B1", "collocation", "They ___ a photo together after the concert.", ["made", "caught", "took", "picked"], "c", "The natural collocation is take a photo."],
  ["B1", "collocation", "We need to ___ a break after three hours of revision.", ["make", "go", "take", "keep"], "c", "The standard collocation is take a break."],
  ["B1", "collocation", "My sister always ___ friends easily when she travels.", ["does", "makes", "gets", "wins"], "b", "The natural phrase is make friends."],
  ["B1", "collocation", "The students ___ their homework before dinner.", ["do", "make", "take", "set"], "a", "We say do homework."],
  ["B1", "collocation", "Our class will ___ part in the science fair next month.", ["play", "make", "take", "keep"], "c", "The correct collocation is take part."],
  ["B1", "collocation", "I need to ___ a phone call before the meeting starts.", ["make", "take", "give", "do"], "a", "The natural phrase is make a phone call."],
  ["B1", "collocation", "Please ___ your best in tomorrow's speaking test.", ["do", "make", "get", "have"], "a", "We say do your best."],
  ["B1", "collocation", "The company will ___ a training course for new staff.", ["do", "run", "take", "play"], "b", "Run a course is the natural collocation here."],

  ["B1", "wordform", "The manager thanked us for our ___ during the busy season.", ["help", "helpful", "helpfully", "helper"], "a", "A noun is needed after our."],
  ["B1", "wordform", "Jade gave a very ___ explanation, so everyone understood.", ["clear", "clearly", "clarity", "clearness"], "a", "An adjective is needed before explanation."],
  ["B1", "wordform", "The weather changed ___, and we had to move inside.", ["sudden", "suddenly", "suddenness", "suddened"], "b", "An adverb modifies changed."],
  ["B1", "wordform", "Regular exercise improves both strength and ___.", ["fit", "fitness", "fitting", "fitly"], "b", "A noun is needed after and."],
  ["B1", "wordform", "His answer was so ___ that the teacher smiled.", ["confidence", "confident", "confidently", "confide"], "b", "An adjective is needed after was so."],
  ["B1", "wordform", "The new library is much more ___ than the old one.", ["comfort", "comfortable", "comfortably", "comforted"], "b", "An adjective compares the library."],
  ["B1", "wordform", "Thank you for responding so ___.", ["quick", "quickly", "quicker", "quickness"], "b", "An adverb modifies responding."],
  ["B1", "wordform", "The exam instructions were written with great ___.", ["care", "careful", "carefully", "careless"], "a", "A noun follows with great."],
  ["B1", "wordform", "Her comments were surprisingly ___ for such a short meeting.", ["use", "useful", "useless", "using"], "b", "An adjective is needed after were."],
  ["B1", "wordform", "The team celebrated the ___ of their project.", ["complete", "completely", "completion", "completing"], "c", "A noun fits after the."],

  ["B2", "meaning", "The proposal was rejected because it was not feasible.", ["cheap enough", "possible to do", "easy to explain", "fully tested"], "b", "Feasible means possible or practical."],
  ["B2", "meaning", "Her comments were brief but insightful.", ["showing deep understanding", "difficult to hear", "full of doubt", "deliberately rude"], "a", "Insightful means showing clear understanding."],
  ["B2", "meaning", "The manager remained cautious throughout the negotiations.", ["careful and avoiding risk", "excited and optimistic", "quiet and shy", "angry and impatient"], "a", "Cautious means careful to avoid problems."],
  ["B2", "meaning", "The region is vulnerable to flooding in winter.", ["well known for tourism", "likely to be harmed", "easy to travel through", "protected by law"], "b", "Vulnerable means open to harm or damage."],
  ["B2", "meaning", "We need a reliable source before publishing the article.", ["fashionable", "trustworthy", "local", "cheap"], "b", "Reliable means trustworthy and dependable."],
  ["B2", "meaning", "His explanation was fairly vague.", ["unclear", "persuasive", "accurate", "formal"], "a", "Vague means unclear or lacking detail."],
  ["B2", "meaning", "The charity depends on voluntary support.", ["required by law", "given willingly", "offered rarely", "supplied overseas"], "b", "Voluntary means done willingly, not forced."],
  ["B2", "meaning", "The new policy had an immediate impact on sales.", ["very small effect", "delayed benefit", "instant effect", "legal problem"], "c", "Immediate impact means an instant effect."],
  ["B2", "meaning", "The two reports are broadly similar.", ["different in every way", "largely alike", "poorly written", "hard to compare"], "b", "Broadly similar means largely alike."],
  ["B2", "meaning", "The lecture focused on the ethical issues involved.", ["financial", "practical", "moral", "historical"], "c", "Ethical relates to moral questions."],

  ["B2", "collocation", "The company plans to ___ an investigation into the complaint.", ["do", "carry out", "take", "bring"], "b", "The standard phrase is carry out an investigation."],
  ["B2", "collocation", "Her speech had a strong ___ on the audience.", ["effect", "affect", "contact", "pressure"], "a", "We say have a strong effect."],
  ["B2", "collocation", "The committee reached a ___ after several hours of debate.", ["conclusion", "finish", "closing", "summary"], "a", "Reach a conclusion is the natural collocation."],
  ["B2", "collocation", "Parents should ___ responsibility for setting limits.", ["take", "do", "keep", "hold"], "a", "The correct collocation is take responsibility."],
  ["B2", "collocation", "We need to ___ progress if we want to finish by Friday.", ["make", "do", "create", "take"], "a", "The natural phrase is make progress."],
  ["B2", "collocation", "The journalist asked a series of ___ questions.", ["sharp", "tight", "hard", "strict"], "a", "Sharp questions is a common collocation for pointed questions."],
  ["B2", "collocation", "Scientists are trying to ___ a solution to the energy shortage.", ["find", "make", "create", "grow"], "a", "Find a solution is the standard collocation."],
  ["B2", "collocation", "The speaker drew ___ to the lack of funding.", ["attention", "interest", "notice", "sight"], "a", "The expression is draw attention to."],
  ["B2", "collocation", "We must keep costs ___ while expanding the service.", ["low", "short", "little", "small"], "a", "Keep costs low is the natural collocation."],
  ["B2", "collocation", "She expressed ___ about the unrealistic schedule.", ["doubt", "worry", "concern", "care"], "c", "Express concern is the correct collocation."],

  ["B2", "wordform", "The board was impressed by the team's ___.", ["innovate", "innovation", "innovative", "innovatively"], "b", "A noun is needed after by the team's."],
  ["B2", "wordform", "The witness described the incident very ___.", ["precise", "precision", "precisely", "preciseness"], "c", "An adverb modifies described."],
  ["B2", "wordform", "Their response was entirely ___.", ["professional", "profession", "professionally", "professionalism"], "a", "An adjective is needed after was."],
  ["B2", "wordform", "The sudden closure caused a lot of ___.", ["confuse", "confusion", "confusing", "confused"], "b", "A noun fits after a lot of."],
  ["B2", "wordform", "It is ___ unlikely that the flight will leave on time.", ["high", "highly", "height", "higher"], "b", "Highly is the correct adverb before unlikely."],
  ["B2", "wordform", "The revised plan seems more ___.", ["practise", "practical", "practically", "practicality"], "b", "An adjective is needed after seems more."],
  ["B2", "wordform", "We were impressed by her ___ to adapt quickly.", ["able", "ability", "ably", "enable"], "b", "A noun is needed after her."],
  ["B2", "wordform", "The film offers a surprisingly ___ view of city life.", ["optimism", "optimist", "optimistic", "optimistically"], "c", "An adjective describes view."],
  ["B2", "wordform", "The software is designed for ease of ___.", ["use", "user", "useful", "using"], "a", "Use is the noun in ease of use."],
  ["B2", "wordform", "Her remarks were met with ___ from the audience.", ["approve", "approval", "approving", "approved"], "b", "A noun is needed after with."],

  ["C1", "meaning", "The director gave a coherent account of the company's strategy.", ["confusing", "logical and well connected", "overly optimistic", "extremely brief"], "b", "Coherent means logical and well connected."],
  ["C1", "meaning", "The findings are preliminary and may change after review.", ["final", "published online", "temporary and not final", "difficult to verify"], "c", "Preliminary means early and not yet final."],
  ["C1", "meaning", "Her refusal to compromise seemed rather rigid.", ["flexible", "strict and unwilling to change", "honest and direct", "carefully planned"], "b", "Rigid means strict and not flexible."],
  ["C1", "meaning", "The article offers a nuanced discussion of migration policy.", ["simplified and one-sided", "subtle and detailed", "biased and emotional", "short and factual"], "b", "Nuanced means showing subtle differences and complexity."],
  ["C1", "meaning", "The mayor's remarks were intended to reassure anxious residents.", ["warn", "instruct", "comfort", "criticize"], "c", "Reassure means make someone feel less worried."],
  ["C1", "meaning", "The treaty remains fragile despite the public celebrations.", ["legally invalid", "easily damaged or broken", "difficult to explain", "widely unpopular"], "b", "Fragile means easily damaged or unstable."],
  ["C1", "meaning", "Her interpretation is plausible, though not proven.", ["ridiculous", "reasonable and believable", "legally required", "completely original"], "b", "Plausible means believable or reasonable."],
  ["C1", "meaning", "The minister's apology was widely perceived as insincere.", ["carefully phrased", "not genuine", "unexpected", "politically risky"], "b", "Insincere means not genuine."],
  ["C1", "meaning", "We need to address the underlying cause, not just the symptoms.", ["obvious", "hidden beneath the surface", "recent", "avoidable"], "b", "Underlying refers to the deeper, basic cause."],
  ["C1", "meaning", "The speaker challenged several long-held assumptions.", ["beliefs accepted for a long time", "recent mistakes", "scientific methods", "personal ambitions"], "a", "Assumptions are beliefs taken for granted."],

  ["C1", "collocation", "The report calls for a ___ assessment of the risks involved.", ["thorough", "thick", "deep", "heavy"], "a", "A thorough assessment is the natural collocation."],
  ["C1", "collocation", "The company must ___ with regulations in every market it enters.", ["obey", "comply", "follow up", "agree"], "b", "The correct phrase is comply with regulations."],
  ["C1", "collocation", "Negotiators are trying to ___ common ground before the summit.", ["reach", "find", "catch", "win"], "b", "Find common ground is the natural collocation."],
  ["C1", "collocation", "Her criticism was intended to ___ a wider debate about fairness.", ["spark", "burn", "light", "raise up"], "a", "Spark a debate is the standard collocation."],
  ["C1", "collocation", "The court will ___ a verdict later this afternoon.", ["deliver", "send", "show", "carry"], "a", "The natural phrase is deliver a verdict."],
  ["C1", "collocation", "The charity relies on volunteers to ___ support to isolated families.", ["provide", "supply with", "offer up", "hand"], "a", "Provide support is the standard collocation."],
  ["C1", "collocation", "Researchers warned that the policy could ___ inequality.", ["deepen", "height", "extend", "stretch"], "a", "Deepen inequality is the most natural collocation."],
  ["C1", "collocation", "The speaker managed to ___ the audience's attention for a full hour.", ["hold", "keep up", "grip on", "carry"], "a", "Hold attention is the standard collocation."],
  ["C1", "collocation", "The board agreed to ___ further funding for the pilot scheme.", ["allocate", "divide", "spend", "commit with"], "a", "Allocate funding is the natural collocation."],
  ["C1", "collocation", "Her article helps to ___ light on an overlooked issue.", ["throw", "cast", "put", "shine"], "d", "The set phrase is shine light on."],

  ["C1", "wordform", "The proposal was praised for its ___ and clarity.", ["concise", "concision", "concisely", "conciseness"], "b", "A noun is needed after its."],
  ["C1", "wordform", "The witnesses responded with remarkable ___.", ["consistent", "consistency", "consistently", "consistence"], "b", "A noun fits after with remarkable."],
  ["C1", "wordform", "The department acted ___ to prevent further losses.", ["decisive", "decision", "decisively", "decided"], "c", "An adverb modifies acted."],
  ["C1", "wordform", "His explanation lacked ___ and failed to convince the panel.", ["cohere", "coherent", "coherently", "coherence"], "d", "A noun is needed after lacked."],
  ["C1", "wordform", "The guide offers a ___ overview of the legal framework.", ["comprehend", "comprehensive", "comprehensively", "comprehension"], "b", "An adjective describes overview."],
  ["C1", "wordform", "The decline in profits is ___ linked to higher fuel prices.", ["direct", "direction", "directly", "directive"], "c", "An adverb modifies linked."],
  ["C1", "wordform", "There is growing ___ about the long-term impact of the reform.", ["uncertain", "uncertainty", "uncertainly", "uncertainties"], "b", "A noun is needed after growing."],
  ["C1", "wordform", "Her account was notable for its ___ detail.", ["exception", "exceptional", "exceptionally", "exceptionality"], "b", "An adjective modifies detail."],
  ["C1", "wordform", "The scheme was introduced to improve energy ___.", ["efficient", "efficiency", "efficiently", "inefficient"], "b", "A noun is needed after energy."],
  ["C1", "wordform", "The team responded with admirable ___.", ["resilient", "resilience", "resiliently", "resile"], "b", "A noun fits after admirable."],

  ["C2", "meaning", "Her analysis was so incisive that it reshaped the whole discussion.", ["superficial but elegant", "sharply insightful", "emotionally charged", "difficult to follow"], "b", "Incisive means sharply clear and insightful."],
  ["C2", "meaning", "The policy was criticized as inherently flawed.", ["popular in principle", "damaged during testing", "wrong in a basic way", "too expensive to maintain"], "c", "Inherently flawed means wrong in its basic nature."],
  ["C2", "meaning", "His tone remained measured despite the provocation.", ["calm and controlled", "sarcastic and mocking", "loud and emotional", "warm and friendly"], "a", "Measured means calm and controlled."],
  ["C2", "meaning", "The novel offers a bleak portrayal of urban isolation.", ["humorous", "hopeful", "dark and depressing", "historically accurate"], "c", "Bleak means dark, without hope."],
  ["C2", "meaning", "The witness gave an unequivocal denial.", ["carefully worded", "absolute and unambiguous", "partly convincing", "surprisingly emotional"], "b", "Unequivocal means leaving no doubt."],
  ["C2", "meaning", "Her argument rests on a dubious assumption about human behaviour.", ["questionable", "widely accepted", "elegant", "mathematical"], "a", "Dubious means doubtful or questionable."],
  ["C2", "meaning", "The committee's response was oddly perfunctory.", ["thorough and balanced", "formal but careless", "honest and direct", "slow but effective"], "b", "Perfunctory means done with little care or interest."],
  ["C2", "meaning", "The minister sought to deflect attention from the scandal.", ["draw attention toward", "avoid dealing with", "explain carefully", "increase public concern"], "b", "Deflect attention means turn it away from something."],
  ["C2", "meaning", "Several critics regarded the apology as disingenuous.", ["more emotional than expected", "not sincerely honest", "legally sufficient", "politically brave"], "b", "Disingenuous means not genuinely sincere."],
  ["C2", "meaning", "The essay presents a compelling rationale for reform.", ["a weak objection", "a confusing summary", "a convincing reason", "a historical comparison"], "c", "A rationale is a reasoned explanation."],

  ["C2", "collocation", "The latest figures ___ serious doubts on the government's forecast.", ["throw", "cast", "put", "make"], "b", "The natural collocation is cast doubts on."],
  ["C2", "collocation", "The editor refused to ___ any responsibility for the error.", ["assume", "hold", "take on", "accept"], "d", "Accept responsibility is the standard collocation here."],
  ["C2", "collocation", "The findings are likely to ___ far-reaching implications for trade policy.", ["have", "make", "create", "carry out"], "a", "Have implications is the natural collocation."],
  ["C2", "collocation", "The biography vividly ___ the hardships of exile.", ["depicts", "draws", "writes", "expresses on"], "a", "Depict hardships is the correct collocation."],
  ["C2", "collocation", "Any reform must ___ the competing interests of workers and employers.", ["balance", "measure", "equal", "compare with"], "a", "Balance competing interests is the natural phrase."],
  ["C2", "collocation", "The announcement was clearly designed to ___ public outrage.", ["contain", "limit", "restrain", "curb"], "d", "Curb outrage is the strongest natural collocation here."],
  ["C2", "collocation", "The paper seeks to ___ conventional wisdom about globalization.", ["challenge", "call", "oppose to", "argue"], "a", "Challenge conventional wisdom is the correct collocation."],
  ["C2", "collocation", "The ambassador attempted to ___ tensions before the talks resumed.", ["lower", "ease", "soften", "calm"], "b", "Ease tensions is the natural collocation."],
  ["C2", "collocation", "The review offers a framework for ___ moral responsibility.", ["assigning", "giving", "putting", "passing"], "a", "Assigning responsibility is the best collocation."],
  ["C2", "collocation", "Her remarks did little to ___ confidence in the institution.", ["restore", "return", "renewed", "repair"], "a", "Restore confidence is the standard collocation."],

  ["C2", "wordform", "Her argument was so ___ that nobody challenged it.", ["persuade", "persuasive", "persuasion", "persuasively"], "b", "An adjective is needed after was so."],
  ["C2", "wordform", "The novel's ___ lies in its refusal to simplify human motives.", ["profound", "profoundly", "profundity", "profundities"], "c", "A noun is needed after the novel's."],
  ["C2", "wordform", "The board questioned the ___ of relying on short-term borrowing.", ["wise", "wisdom", "wisely", "unwise"], "b", "A noun fits after questioned the."],
  ["C2", "wordform", "The response was handled with impressive ___.", ["diplomatic", "diplomacy", "diplomatically", "diplomat"], "b", "A noun is needed after with impressive."],
  ["C2", "wordform", "Such claims are not merely exaggerated but factually ___.", ["indefensible", "indefence", "indefensibly", "defenseless"], "a", "An adjective is needed after are."],
  ["C2", "wordform", "The report was criticized for its ___ optimism.", ["naive", "naivety", "naively", "naivest"], "b", "A noun is needed before optimism in this structure."],
  ["C2", "wordform", "The witness answered with unexpected ___.", ["frank", "frankly", "frankness", "franker"], "c", "A noun follows with unexpected."],
  ["C2", "wordform", "The policy's success depends on the ___ of local officials.", ["cooperate", "cooperative", "cooperation", "cooperatively"], "c", "A noun is needed after depends on the."],
  ["C2", "wordform", "Her interpretation was notable for its ___.", ["subtle", "subtly", "subtlety", "subtleties"], "c", "A noun is needed after for its."],
  ["C2", "wordform", "The committee responded with surprising ___.", ["swift", "swiftly", "swiftness", "swifter"], "c", "A noun fits after with surprising."],
];

function buildDemoQuestions() {
  return DEMO_QUESTION_BLUEPRINTS.map(
    ([level, type, prompt, options, correctOptionId, explanation]) =>
      createQuestion(level, type, prompt, options, correctOptionId, explanation)
  );
}

module.exports = {
  DEMO_SEED_TAG,
  DEMO_SOURCE,
  buildDemoQuestions,
};
