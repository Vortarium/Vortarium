// ZenWords - Peaceful Word Search Game
// A calming word search experience themed around a zen tea house

// ==================== DEVTOOLS TOGGLE ====================
// Set to true for testing, false for release
const ENABLE_DEVTOOLS = true;

// ==================== GAME STATE ====================
const GameState = {
    currentScreen: 'main-menu',
    gameMode: null, // 'journey', 'endless', 'daily'
    difficulty: 'easy',
    currentLevel: 1,
    grid: [],
    gridSize: 8,
    gridWidth: 5,
    gridHeight: 5,
    words: [],
    foundWords: [],
    wordPositions: [],
    selectedCells: [],
    isSelecting: false,
    selectionStart: null,
    score: 0,
    timer: 0,
    timerInterval: null,
    isPaused: false,
    combo: 0,
    comboTimer: null,
    inactivityTimer: null,
    hintsRemaining: 5,
    maxHints: 5,
    hintRechargeTime: 60 * 60 * 1000, // 1 hour in milliseconds
    hintRechargeStart: null,
    focusMode: false,
    dailySeed: null,
    dailyCompleted: false,
    playtime: 0,
    playtimeInterval: null,
    isTabActive: true,
    selectedCategory: 'all',
    isReadOnly: false,
    autocompleteEnabled: false,
    leagueTimerInterval: null
};

// ==================== 100-TIER JOURNEY PROGRESSION ====================
const JourneyTiers = [];
let gridWidth = 5;
let gridHeight = 5;
let wordCount = 2;

for (let tier = 1; tier <= 100; tier++) {
    const startLevel = (tier - 1) * 10 + 1;
    const endLevel = tier * 10;
    
    JourneyTiers.push({
        tier,
        gridWidth,
        gridHeight,
        wordCount,
        startLevel,
        endLevel
    });
    
    // Increment difficulty by ONE of: grid width, grid height, or word count
    if (tier % 3 === 0) {
        wordCount++;
        if (tier > 50 && tier % 2 === 0) wordCount++; // Add +2 occasionally at higher tiers
    } else if (tier % 3 === 1) {
        gridWidth++;
    } else {
        gridHeight++;
    }
}

// ==================== WORD DICTIONARY ====================
const WordDictionary = {
    nature: [
        'bamboo', 'forest', 'mountain', 'river', 'breeze', 'bloom', 'petal', 'leaf', 'tree', 'garden', 
        'meadow', 'stream', 'lake', 'ocean', 'cloud', 'mist', 'dew', 'rain', 'snow', 'blossom', 'cherry', 
        'willow', 'pine', 'oak', 'maple', 'cedar', 'moss', 'fern', 'grass', 'flower', 'rose', 'lily', 
        'lotus', 'iris', 'tulip', 'daisy', 'sunflower', 'lavender', 'jasmine', 'orchid', 'valley', 'canyon', 
        'glacier', 'volcano', 'island', 'peninsula', 'cove', 'bay', 'reef', 'coral', 'sand', 'pebble', 
        'boulder', 'cliff', 'ridge', 'summit', 'peak', 'crater', 'dune', 'desert', 'oasis', 'jungle', 
        'rainforest', 'swamp', 'marsh', 'bog', 'tundra', 'savanna', 'prairie', 'shrub', 'bush', 'vine', 
        'root', 'bark', 'twig', 'branch', 'trunk', 'sapling', 'seedling', 'spore', 'fungus', 'mushroom', 
        'lichen', 'algae', 'seaweed', 'kelp', 'tide', 'wave', 'current', 'ripple', 'waterfall', 'spring', 
        'geyser', 'creek', 'brook', 'estuary', 'delta', 'gorge', 'plateau', 'mesa', 'cave', 'cavern', 
        'mineral', 'crystal', 'quartz', 'jade', 'amber', 'soil', 'clay', 'mud', 'dust', 'ash'
    ],
    weather: [
        'rain', 'storm', 'cloud', 'wind', 'snow', 'fog', 'mist', 'thunder', 'lightning', 'breeze', 
        'drizzle', 'shower', 'downpour', 'blizzard', 'hurricane', 'tornado', 'cyclone', 'monsoon', 
        'drought', 'heatwave', 'frost', 'hail', 'sleet', 'rainbow', 'sunshine', 'sunlight', 'twilight', 
        'dawn', 'dusk', 'sunset', 'sunrise', 'moonlight', 'starlight', 'clear', 'overcast', 'humid', 
        'dry', 'wet', 'tempest', 'gale', 'squall', 'typhoon', 'whirlwind', 'dustdevil', 'sandstorm', 
        'avalanche', 'ice', 'icicle', 'flurry', 'slush', 'melt', 'thaw', 'freeze', 'chill', 'cold', 
        'cool', 'warm', 'hot', 'scorching', 'blistering', 'sweltering', 'muggy', 'clammy', 'damp', 
        'dewpoint', 'humidity', 'barometer', 'pressure', 'front', 'updraft', 'downdraft', 'stratosphere', 
        'troposphere', 'atmosphere', 'ozone', 'smog', 'haze', 'stratus', 'cumulus', 'cirrus', 'nimbus', 
        'altocumulus', 'stratocumulus', 'gloom', 'shade', 'shadow', 'glare', 'ray', 'beam', 'flash', 
        'strike', 'rumble', 'roar', 'howl', 'gust', 'draft', 'zephyr', 'trade-wind', 'jet'
    ],
    tea: [
        'tea', 'brew', 'steep', 'sip', 'cup', 'mug', 'pot', 'kettle', 'infusion', 'herbal', 'green', 
        'black', 'oolong', 'white', 'puerh', 'matcha', 'chai', 'rooibos', 'jasmine', 'earl', 'grey', 
        'sencha', 'gyokuro', 'houjicha', 'genmaicha', 'bancha', 'darjeeling', 'assam', 'ceylon', 'keemun', 
        'yunnan', 'longjing', 'biluochun', 'tieguanyin', 'da hong pao', 'milk', 'sugar', 'honey', 'lemon', 
        'ginger', 'mint', 'cinnamon', 'cardamom', 'clove', 'saucer', 'teaspoon', 'strainer', 'filter', 
        'loose-leaf', 'bag', 'sachet', 'tannin', 'caffeine', 'antioxidant', 'aroma', 'flavor', 'bitter', 
        'sweet', 'astringent', 'earthy', 'floral', 'fruity', 'nutty', 'roasted', 'smoked', 'malty', 
        'steaming', 'hot', 'iced', 'brew', 'boba', 'tapioca', 'pearl', 'bubble', 'ceremony', 'chanoyu', 
        'chawan', 'chasen', 'chashaku', 'gongfu', 'gaiwan', 'yixing', 'clay', 'porcelain', 'ceramic', 
        'harvest', 'flush', 'pluck', 'wither', 'oxidize', 'ferment', 'dry', 'blend', 'tisane', 'chamomile', 
        'peppermint', 'hibiscus', 'lemongrass', 'rosehip', 'bergamot', 'vanilla', 'nutmeg', 'anise'
    ],
    zen: [
        'zen', 'peace', 'calm', 'mindful', 'meditate', 'breathe', 'stillness', 'silence', 'tranquil', 
        'serene', 'harmony', 'balance', 'focus', 'present', 'aware', 'awake', 'enlighten', 'wisdom', 
        'compassion', 'kindness', 'patience', 'acceptance', 'letting', 'go', 'flow', 'being', 'presence', 
        'mindfulness', 'insight', 'clarity', 'purpose', 'meaning', 'spirit', 'soul', 'heart', 'essence', 
        'nature', 'simplicity', 'minimalism', 'zazen', 'koan', 'satori', 'nirvana', 'tao', 'yin', 'yang', 
        'chi', 'prana', 'chakra', 'mantra', 'om', 'chant', 'singing-bowl', 'incense', 'sand-garden', 
        'bonsai', 'koi', 'lotus', 'bamboo', 'stone', 'water', 'reflection', 'emptiness', 'void', 'mu', 
        'detachment', 'surrender', 'gratitude', 'humility', 'gentleness', 'softness', 'yielding', 'centered', 
        'grounded', 'rooted', 'aligned', 'connected', 'one', 'unity', 'wholeness', 'healing', 'rest', 
        'pause', 'space', 'gap', 'breath', 'inhale', 'exhale', 'posture', 'asana', 'yoga', 'qigong', 
        'taichi', 'movement', 'still', 'quiet', 'hush', 'whisper', 'listen', 'observe', 'witness', 
        'equanimity', 'bliss', 'joy', 'contentment', 'enough', 'now', 'here', 'moment'
    ],
    emotions: [
        'joy', 'peace', 'love', 'hope', 'faith', 'trust', 'gratitude', 'kindness', 'compassion', 'empathy', 
        'courage', 'strength', 'wisdom', 'patience', 'humility', 'generosity', 'forgiveness', 'acceptance', 
        'serenity', 'tranquility', 'contentment', 'happiness', 'bliss', 'delight', 'cheer', 'glee', 'mirth', 
        'elation', 'euphoria', 'excitement', 'enthusiasm', 'zest', 'vigor', 'vitality', 'energy', 'calm', 
        'relaxed', 'comfortable', 'secure', 'sadness', 'sorrow', 'grief', 'melancholy', 'despair', 
        'angst', 'anxiety', 'fear', 'terror', 'panic', 'worry', 'stress', 'tension', 'anger', 'rage', 
        'fury', 'wrath', 'frustration', 'annoyance', 'irritation', 'disgust', 'revulsion', 'contempt', 
        'envy', 'jealousy', 'pride', 'arrogance', 'shame', 'guilt', 'remorse', 'regret', 'embarrassment', 
        'loneliness', 'isolation', 'alienation', 'boredom', 'apathy', 'indifference', 'numbness', 'shock', 
        'surprise', 'astonishment', 'amazement', 'awe', 'wonder', 'curiosity', 'interest', 'fascination', 
        'confusion', 'bewilderment', 'doubt', 'skepticism', 'suspicion', 'relief', 'satisfaction', 'pride', 
        'triumph', 'affection', 'fondness', 'adoration', 'devotion', 'passion', 'desire', 'longing', 
        'yearning', 'nostalgia', 'sentiment', 'sympathy', 'pity'
    ],
    animals: [
        'cat', 'dog', 'bird', 'fish', 'crane', 'heron', 'swan', 'duck', 'goose', 'sparrow', 'robin', 
        'eagle', 'hawk', 'owl', 'nightingale', 'swallow', 'finch', 'canary', 'parrot', 'peacock', 'phoenix', 
        'dragon', 'tiger', 'lion', 'elephant', 'deer', 'rabbit', 'squirrel', 'chipmunk', 'beaver', 'otter', 
        'fox', 'wolf', 'bear', 'panda', 'koala', 'kangaroo', 'turtle', 'tortoise', 'frog', 'toad', 'snake', 
        'lizard', 'butterfly', 'dragonfly', 'bee', 'ant', 'spider', 'scorpion', 'horse', 'pony', 'donkey', 
        'mule', 'cow', 'bull', 'calf', 'sheep', 'ram', 'lamb', 'goat', 'pig', 'boar', 'chicken', 'rooster', 
        'hen', 'chick', 'turkey', 'pigeon', 'dove', 'crow', 'raven', 'magpie', 'jay', 'woodpecker', 
        'hummingbird', 'pelican', 'seagull', 'albatross', 'penguin', 'seal', 'walrus', 'whale', 'dolphin', 
        'shark', 'ray', 'octopus', 'squid', 'crab', 'lobster', 'shrimp', 'clam', 'oyster', 'snail', 'slug', 
        'worm', 'caterpillar', 'moth', 'beetle', 'ladybug', 'cricket', 'grasshopper', 'mantis', 'wasp', 
        'hornet', 'fly', 'mosquito', 'flea', 'tick', 'mouse', 'rat', 'hamster', 'gerbil', 'guinea-pig', 
        'ferret', 'mink', 'weasel', 'badger', 'skunk', 'raccoon', 'opossum', 'bat', 'sloth', 'monkey', 
        'ape', 'chimpanzee', 'gorilla', 'orangutan', 'lemur', 'camel', 'llama', 'alpaca', 'giraffe', 'zebra', 
        'rhino', 'hippo', 'crocodile', 'alligator', 'iguana', 'chameleon', 'gecko'
    ],
    seasons: [
        'spring', 'summer', 'autumn', 'winter', 'season', 'equinox', 'solstice', 'bloom', 'blossom', 
        'harvest', 'frost', 'thaw', 'bud', 'sprout', 'grow', 'wither', 'fade', 'fall', 'leaf', 'petal', 
        'flower', 'fruit', 'seed', 'pollen', 'nectar', 'sap', 'root', 'branch', 'trunk', 'bark', 'wood', 
        'timber', 'forest', 'grove', 'orchard', 'meadow', 'field', 'pasture', 'garden', 'park', 'yard', 
        'lawn', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 
        'october', 'november', 'december', 'vernal', 'autumnal', 'hibernation', 'migration', 'monsoon', 
        'dry-season', 'wet-season', 'mud-season', 'indian-summer', 'midsummer', 'midwinter', 'yule', 
        'beltane', 'samhain', 'imbolc', 'lughnasadh', 'ostara', 'mabon', 'litha', 'green', 'yellow', 
        'orange', 'red', 'brown', 'bare', 'evergreen', 'deciduous', 'perennial', 'annual', 'biennial', 
        'planting', 'sowing', 'reaping', 'gathering', 'foraging', 'preserving', 'canning', 'pickling', 
        'fermenting', 'sweat', 'bask', 'swim', 'ski', 'sled', 'skate', 'snowball', 'snowman', 'fireplace', 
        'hearth', 'bonfire', 'barbecue', 'picnic', 'camping', 'hiking', 'hayride', 'corn-maze', 'pumpkin', 
        'apple-picking', 'cider', 'hot-cocoa', 'mulled-wine', 'eggnog', 'sunscreen', 'sunglasses', 'scarf', 
        'mittens', 'gloves', 'boots', 'coat', 'jacket', 'sweater', 'shorts', 'sandals'
    ],
    philosophy: [
        'wisdom', 'truth', 'knowledge', 'understanding', 'insight', 'perception', 'awareness', 
        'consciousness', 'mind', 'thought', 'idea', 'concept', 'theory', 'philosophy', 'ethics', 'morality', 
        'virtue', 'justice', 'fairness', 'equality', 'freedom', 'liberty', 'rights', 'duty', 'responsibility', 
        'obligation', 'commitment', 'dedication', 'devotion', 'loyalty', 'fidelity', 'honor', 'integrity', 
        'honesty', 'sincerity', 'authenticity', 'genuineness', 'truthfulness', 'logic', 'reason', 'rationality', 
        'empiricism', 'rationalism', 'existentialism', 'nihilism', 'stoicism', 'epistemology', 'metaphysics', 
        'ontology', 'aesthetics', 'phenomenology', 'pragmatism', 'utilitarianism', 'idealism', 'realism', 
        'materialism', 'dualism', 'monism', 'determinism', 'free-will', 'fatalism', 'relativism', 'absolutism', 
        'subjectivity', 'objectivity', 'paradigm', 'dogma', 'doctrine', 'axiom', 'premise', 'conclusion', 
        'argument', 'fallacy', 'syllogism', 'deduction', 'induction', 'dialectic', 'thesis', 'antithesis', 
        'synthesis', 'humanism', 'transcendentalism', 'cynicism', 'skepticism', 'solipsism', 'altruism', 
        'egoism', 'hedonism', 'asceticism', 'mysticism', 'theology', 'pantheism', 'deism', 'theism', 
        'atheism', 'agnosticism', 'secularism', 'piety', 'sacred', 'profane', 'divine', 'mortal', 'immortal', 
        'eternal', 'infinite', 'finite', 'being', 'nothingness', 'becoming', 'essence', 'existence', 
        'substance', 'form', 'matter', 'causality', 'teleology'
    ],
    astronomy: [
        'star', 'moon', 'sun', 'planet', 'comet', 'meteor', 'asteroid', 'galaxy', 'nebula', 'constellation', 
        'orbit', 'eclipse', 'phase', 'lunar', 'solar', 'cosmos', 'universe', 'space', 'void', 'darkness', 
        'light', 'radiance', 'glow', 'shine', 'sparkle', 'twinkle', 'beam', 'ray', 'spectrum', 'prism', 
        'rainbow', 'aurora', 'zenith', 'nadir', 'horizon', 'meridian', 'equator', 'pole', 'axis', 'rotation', 
        'revolution', 'gravity', 'vacuum', 'telescope', 'observatory', 'satellite', 'probe', 'rocket', 
        'shuttle', 'astronaut', 'cosmonaut', 'astronomer', 'astrophysics', 'cosmology', 'milky-way', 
        'andromeda', 'orion', 'ursa-major', 'ursa-minor', 'sirius', 'polaris', 'pleiades', 'zodiac', 
        'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 
        'aquarius', 'pisces', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 
        'pluto', 'exoplanet', 'supernova', 'black-hole', 'quasar', 'pulsar', 'neutron-star', 'white-dwarf', 
        'red-giant', 'brown-dwarf', 'dark-matter', 'dark-energy', 'big-bang', 'singularity', 'event-horizon', 
        'wormhole', 'light-year', 'parsec', 'astronomical-unit', 'celestial', 'sphere', 'ecliptic', 
        'equinox', 'solstice', 'crescent', 'gibbous', 'waxing', 'waning', 'new-moon', 'full-moon', 
        'halo', 'corona', 'flare', 'sunspot', 'solar-wind'
    ],
    food: [
        'rice', 'noodle', 'soup', 'stew', 'curry', 'stir-fry', 'steam', 'boil', 'roast', 'grill', 'bake', 
        'sauté', 'sushi', 'ramen', 'tempura', 'dumpling', 'wonton', 'spring-roll', 'dim-sum', 'bento', 
        'sashimi', 'teriyaki', 'yakitori', 'takoyaki', 'okonomiyaki', 'mochi', 'manju', 'dorayaki', 
        'taiyaki', 'daifuku', 'anko', 'matcha', 'red-bean', 'sesame', 'soy-sauce', 'miso', 'wasabi', 
        'ginger', 'garlic', 'onion', 'scallion', 'bread', 'toast', 'sandwich', 'burger', 'pizza', 'pasta', 
        'spaghetti', 'macaroni', 'cheese', 'butter', 'milk', 'cream', 'yogurt', 'egg', 'meat', 'beef', 
        'pork', 'chicken', 'lamb', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'vegetable', 
        'potato', 'carrot', 'broccoli', 'spinach', 'lettuce', 'tomato', 'cucumber', 'pepper', 'mushroom', 
        'fruit', 'apple', 'banana', 'orange', 'grape', 'strawberry', 'blueberry', 'melon', 'watermelon', 
        'pineapple', 'mango', 'papaya', 'coconut', 'nut', 'peanut', 'almond', 'walnut', 'cashew', 'seed', 
        'sunflower-seed', 'pumpkin-seed', 'spice', 'salt', 'pepper', 'sugar', 'honey', 'syrup', 'vinegar', 
        'oil', 'olive-oil', 'sesame-oil', 'flour', 'dough', 'batter', 'cake', 'cookie', 'pie', 'pastry', 
        'chocolate', 'candy', 'ice-cream', 'pudding', 'jelly', 'jam', 'marmalade', 'breakfast', 'lunch', 
        'dinner', 'supper', 'snack', 'dessert', 'appetizer', 'entree', 'buffet', 'banquet', 'feast'
    ],
    mythology: [
        'dragon', 'phoenix', 'crane', 'turtle', 'tiger', 'kirin', 'kitsune', 'tanuki', 'tengu', 'oni', 
        'yokai', 'kami', 'shinto', 'buddha', 'bodhisattva', 'nirvana', 'samsara', 'karma', 'dharma', 
        'zen', 'koan', 'zazen', 'sutra', 'mantra', 'mandala', 'lotus', 'chakra', 'aura', 'spirit', 
        'soul', 'ghost', 'demon', 'angel', 'deity', 'god', 'goddess', 'oracle', 'prophecy', 'destiny', 
        'fate', 'fortune', 'luck', 'myth', 'legend', 'folklore', 'fable', 'tale', 'epic', 'saga', 'hero', 
        'heroine', 'villain', 'monster', 'beast', 'creature', 'chimera', 'griffin', 'sphinx', 'centaur', 
        'minotaur', 'pegasus', 'unicorn', 'mermaid', 'siren', 'nymph', 'fairy', 'elf', 'dwarf', 'giant', 
        'troll', 'goblin', 'orc', 'ogre', 'vampire', 'werewolf', 'zombie', 'mummy', 'witch', 'wizard', 
        'sorcerer', 'mage', 'magician', 'druid', 'shaman', 'priest', 'priestess', 'temple', 'shrine', 
        'altar', 'sacrifice', 'offering', 'ritual', 'ceremony', 'spell', 'charm', 'curse', 'hex', 'potion', 
        'elixir', 'alchemy', 'magic', 'sorcery', 'witchcraft', 'illusion', 'miracle', 'divination', 
        'astrology', 'tarot', 'runes', 'amulet', 'talisman', 'relic', 'artifact', 'weapon', 'sword', 
        'shield', 'bow', 'arrow', 'spear', 'staff', 'wand', 'crown', 'throne', 'kingdom', 'realm', 
        'underworld', 'heaven', 'hell', 'abyss', 'limbo', 'purgatory', 'elysium', 'valhalla', 'olympus', 
        'asgard', 'pantheon', 'creation', 'apocalypse', 'ragnarok', 'genesis', 'deluge'
    ],
    music: [
        'note', 'chord', 'melody', 'harmony', 'rhythm', 'beat', 'tempo', 'scale', 'key', 'pitch', 
        'octave', 'interval', 'tune', 'song', 'piece', 'composition', 'symphony', 'concerto', 'sonata', 
        'opera', 'ballet', 'dance', 'waltz', 'tango', 'samba', 'rumba', 'jazz', 'blues', 'rock', 
        'pop', 'folk', 'country', 'classical', 'baroque', 'romantic', 'modern', 'contemporary', 'avantgarde', 
        'instrument', 'piano', 'guitar', 'violin', 'cello', 'flute', 'clarinet', 'saxophone', 'trumpet', 
        'drum', 'percussion', 'strings', 'brass', 'woodwind', 'keyboard', 'synthesizer', 'organ', 'harp', 
        'lute', 'mandolin', 'banjo', 'ukulele', 'accordion', 'concert', 'performance', 'recital', 'audition', 
        'rehearsal', 'practice', 'scales', 'arpeggios', 'etude', 'sonata', 'nocturne', 'serenade', 'overture', 
        'prelude', 'fugue', 'cantata', 'oratorio', 'aria', 'chorus', 'choir', 'ensemble', 'orchestra', 
        'band', 'quartet', 'quintet', 'sextet', 'septet', 'octet', 'nonet', 'solo', 'duet', 'trio', 
        'conductor', 'composer', 'musician', 'artist', 'performer', 'singer', 'vocalist', 'lyricist', 
        'songwriter', 'producer', 'studio', 'stage', 'venue', 'auditorium', 'theater', 'amphitheater', 
        'acoustics', 'sound', 'volume', 'dynamics', 'crescendo', 'decrescendo', 'forte', 'piano', 'mezzo', 
        'staccato', 'legato', 'vibrato', 'tremolo', 'glissando', 'portamento', 'trill', 'mordent', 
        'turn', 'gracenote', 'appoggiatura', 'accidental', 'sharp', 'flat', 'natural', 'clef', 'staff', 
        'treble', 'bass', 'alto', 'tenor', 'soprano', 'baritone', 'mezzosoprano', 'contralto', 'bassbaritone'
    ],
    art: [
        'paint', 'draw', 'sketch', 'color', 'shade', 'tint', 'hue', 'tone', 'value', 'saturation', 
        'brush', 'canvas', 'easel', 'palette', 'pigment', 'oil', 'acrylic', 'watercolor', 'gouache', 
        'pastel', 'charcoal', 'pencil', 'ink', 'pen', 'marker', 'crayon', 'chalk', 'collage', 'mosaic', 
        'sculpture', 'carve', 'model', 'cast', 'weld', 'clay', 'stone', 'marble', 'bronze', 'wood', 
        'metal', 'ceramic', 'pottery', 'glass', 'blow', 'kiln', 'wheel', 'glaze', 'fire', 'enamel', 
        'print', 'etch', 'engrave', 'lithograph', 'screenprint', 'woodcut', 'linocut', 'monotype', 
        'photograph', 'camera', 'lens', 'shutter', 'aperture', 'exposure', 'focus', 'composition', 
        'perspective', 'depth', 'light', 'shadow', 'contrast', 'balance', 'proportion', 'scale', 
        'texture', 'pattern', 'design', 'style', 'movement', 'school', 'genre', 'portrait', 'landscape', 
        'stilllife', 'abstract', 'realism', 'impressionism', 'expressionism', 'surrealism', 'cubism', 
        'popart', 'minimalism', 'conceptual', 'installation', 'performance', 'video', 'digital', 
        'mixedmedia', 'gallery', 'museum', 'exhibition', 'show', 'opening', 'reception', 'critic', 
        'curator', 'collector', 'patron', 'artist', 'masterpiece', 'work', 'piece', 'creation', 
        'inspiration', 'muse', 'vision', 'imagination', 'creativity', 'talent', 'skill', 'technique', 
        'craft', 'aesthetic', 'beauty', 'elegance', 'grace', 'harmony', 'unity', 'variety', 'rhythm'
    ],
    sports: [
        'sport', 'game', 'match', 'competition', 'tournament', 'championship', 'league', 'season', 
        'team', 'player', 'athlete', 'coach', 'trainer', 'referee', 'umpire', 'judge', 'score', 
        'point', 'goal', 'touchdown', 'run', 'homerun', 'basket', 'goal', 'strike', 'spare', 
        'ace', 'birdie', 'eagle', 'holeinone', 'par', 'bogey', 'doublebogey', 'triplebogey', 
        'win', 'lose', 'draw', 'tie', 'victory', 'defeat', 'champion', 'winner', 'loser', 'medal', 
        'trophy', 'cup', 'award', 'prize', 'record', 'recordbreaker', 'legend', 'halloffame', 
        'stadium', 'arena', 'field', 'court', 'pitch', 'track', 'course', 'pool', 'rink', 'gym', 
        'football', 'soccer', 'basketball', 'baseball', 'hockey', 'tennis', 'golf', 'swimming', 
        'running', 'track', 'field', 'cycling', 'boxing', 'wrestling', 'martialarts', 'karate', 
        'judo', 'taekwondo', 'jiujitsu', 'fencing', 'archery', 'shooting', 'skiing', 'snowboarding', 
        'skating', 'figureskating', 'speedskating', 'surfing', 'rowing', 'canoeing', 'kayaking', 
        'sailing', 'diving', 'gymnastics', 'volleyball', 'badminton', 'tabletennis', 'cricket', 
        'rugby', 'lacrosse', 'softball', 'bowling', 'darts', 'billiards', 'pool', 'snooker', 
        'chess', 'checkers', 'backgammon', 'poker', 'bridge', 'rummy', 'solitaire', 'crossword', 
        'sudoku', 'puzzle', 'exercise', 'fitness', 'training', 'workout', 'warmup', 'cooldown', 
        'stretch', 'strength', 'endurance', 'stamina', 'agility', 'flexibility', 'balance', 'coordination'
    ],
    technology: [
        'computer', 'phone', 'tablet', 'laptop', 'desktop', 'monitor', 'keyboard', 'mouse', 'trackpad', 
        'screen', 'display', 'touchscreen', 'processor', 'cpu', 'memory', 'ram', 'storage', 'harddrive', 
        'ssd', 'flashdrive', 'usb', 'cloud', 'server', 'network', 'internet', 'web', 'browser', 
        'website', 'app', 'application', 'software', 'program', 'code', 'programming', 'developer', 
        'engineer', 'hacker', 'cybersecurity', 'encryption', 'password', 'login', 'account', 'profile', 
        'database', 'algorithm', 'data', 'information', 'digital', 'virtual', 'artificial', 'intelligence', 
        'machinelearning', 'robot', 'robotics', 'automation', 'iot', 'smarthome', 'wearable', 
        'smartwatch', 'fitnesstracker', 'headphones', 'earbuds', 'speaker', 'microphone', 'camera', 
        'video', 'streaming', 'download', 'upload', 'bandwidth', 'wifi', 'bluetooth', 'fiveg', 'fourg', 
        'lte', 'satellite', 'gps', 'navigation', 'map', 'location', 'tracking', 'sensor', 'detector', 
        'scanner', 'printer', 'copier', 'fax', 'teleconference', 'videocall', 
        'messaging', 'email', 'chat', 'socialmedia', 
        'startup', 'unicorn', 'ipo', 'stock', 'market', 'economy', 'business', 'entrepreneur', 
        'innovation', 'invention', 'patent', 'copyright', 'trademark', 'license', 'opensource', 
        'proprietary', 'commercial', 'consumer', 'enterprise', 'industrial', 'military', 'government'
    ],
    geography: [
        'continent', 'country', 'nation', 'state', 'province', 'region', 'territory', 'district', 
        'county', 'city', 'town', 'village', 'hamlet', 'metropolis', 'capital', 'border', 'boundary', 
        'frontier', 'coast', 'shoreline', 'beach', 'coastline', 'peninsula', 'island', 'archipelago', 
        'atoll', 'reef', 'isthmus', 'strait', 'channel', 'canal', 'river', 'lake', 'sea', 'ocean', 
        'gulf', 'bay', 'cove', 'harbor', 'port', 'mountain', 'peak', 'summit', 'range', 'volcano', 
        'valley', 'canyon', 'gorge', 'cliff', 'plateau', 'mesa', 'plain', 'prairie', 'steppe', 
        'desert', 'tundra', 'taiga', 'savanna', 'rainforest', 'jungle', 'forest', 'woodland', 
        'grassland', 'wetland', 'swamp', 'marsh', 'bog', 'fen', 'glacier', 'iceberg', 'icesheet', 
        'pole', 'arctic', 'antarctic', 'equator', 'tropic', 'hemisphere', 'latitude', 'longitude', 
        'coordinate', 'grid', 'map', 'atlas', 'globe', 'compass', 'north', 'south', 'east', 'west', 
        'cardinal', 'direction', 'bearing', 'azimuth', 'elevation', 'altitude', 'depth', 'sealevel', 
        'topography', 'terrain', 'landscape', 'geology', 'tectonic', 'fault', 'earthquake', 
        'volcanic', 'eruption', 'magma', 'lava', 'ash', 'crater', 'caldera', 'geyser', 'hotspring', 
        'mineral', 'ore', 'metal', 'gem', 'jewel', 'diamond', 'ruby', 'emerald', 'sapphire', 'gold', 
        'silver', 'copper', 'iron', 'steel', 'aluminum', 'titanium', 'platinum', 'resource', 'reserve', 
        'mine', 'quarry', 'excavation', 'drilling', 'fracking', 'petroleum', 'oil', 'gas', 'coal', 
        'nuclear', 'solar', 'wind', 'hydro', 'geothermal', 'biomass', 'renewable', 'sustainable'
    ],
    science: [
        'science', 'physics', 'chemistry', 'biology', 'geology', 'astronomy', 'cosmology', 'quantum', 
        'relativity', 'mechanics', 'thermodynamics', 'electromagnetism', 'optics', 'acoustics', 'fluid', 
        'solidstate', 'particle', 'nuclear', 'atomic', 'molecular', 'chemical', 'organic', 'inorganic', 
        'biochemistry', 'genetics', 'genomics', 'evolution', 'ecology', 'environment', 'climate', 
        'meteorology', 'oceanography', 'geophysics', 'seismology', 'volcanology', 'paleontology', 
        'archaeology', 'anthropology', 'sociology', 'psychology', 'neuroscience', 'medicine', 'health', 
        'disease', 'virus', 'bacteria', 'fungus', 'parasite', 'infection', 'immune', 'vaccine', 
        'antibiotic', 'treatment', 'therapy', 'surgery', 'diagnosis', 'symptom', 'cure', 'prevention', 
        'epidemic', 'pandemic', 'outbreak', 'quarantine', 'isolation', 'publichealth', 'wellness', 
        'fitness', 'nutrition', 'diet', 'exercise', 'metabolism', 'digestion', 'respiration', 
        'circulation', 'nervous', 'skeletal', 'muscular', 'organ', 'tissue', 'cell', 'dna', 'rna', 
        'gene', 'chromosome', 'mutation', 'adaptation', 'selection', 'species', 'organism', 'ecosystem', 
        'habitat', 'niche', 'biodiversity', 'conservation', 'sustainability', 'pollution', 'waste', 
        'recycling', 'renewable', 'energy', 'power', 'electricity', 'magnetism', 'gravity', 'force', 
        'motion', 'velocity', 'acceleration', 'momentum', 'inertia', 'mass', 'weight', 'density', 
        'volume', 'pressure', 'temperature', 'heat', 'cold', 'phase', 'solid', 'liquid', 'gas', 
        'plasma', 'element', 'compound', 'mixture', 'solution', 'suspension', 'colloid', 'reaction', 
        'catalyst', 'enzyme', 'protein', 'carbohydrate', 'lipid', 'vitamin', 'mineral', 'nutrient'
    ],
    history: [
        'history', 'past', 'present', 'future', 'time', 'era', 'epoch', 'age', 'period', 'century', 
        'millennium', 'decade', 'year', 'month', 'week', 'day', 'hour', 'minute', 'second', 'moment', 
        'ancient', 'medieval', 'modern', 'contemporary', 'prehistoric', 'antiquity', 'classical', 
        'renaissance', 'enlightenment', 'industrial', 'revolution', 'war', 'peace', 'conflict', 
        'battle', 'siege', 'conquest', 'empire', 'kingdom', 'dynasty', 'monarchy', 'republic', 
        'democracy', 'dictatorship', 'tyranny', 'anarchy', 'communism', 'socialism', 'capitalism', 
        'fascism', 'colonialism', 'imperialism', 'nationalism', 'globalization', 'civilization', 
        'culture', 'society', 'people', 'nation', 'tribe', 'clan', 'family', 'lineage', 'ancestry', 
        'heritage', 'tradition', 'custom', 'ritual', 'ceremony', 'festival', 'celebration', 'holiday', 
        'monument', 'memorial', 'statue', 'artifact', 'relic', 'ruin', 'site', 'excavation', 
        'archaeology', 'anthropology', 'paleontology', 'fossil', 'evolution', 'migration', 'diaspora', 
        'colonization', 'settlement', 'colony', 'territory', 'border', 'frontier', 'exploration', 
        'discovery', 'invention', 'innovation', 'progress', 'development', 'growth', 'decline', 
        'collapse', 'fall', 'rise', 'emergence', 'origin', 'beginning', 'end', 'conclusion', 
        'legacy', 'memory', 'record', 'document', 'archive', 'manuscript', 'scroll', 'book', 
        'text', 'writing', 'alphabet', 'language', 'literature', 'poetry', 'prose', 'drama', 
        'philosophy', 'religion', 'faith', 'belief', 'spirituality', 'mythology', 'legend', 
        'folklore', 'oraltradition', 'storytelling', 'narrative', 'chronicle', 'annals', 'history'
    ],
    literature: [
        'book', 'novel', 'story', 'tale', 'narrative', 'plot', 'character', 'protagonist', 'antagonist', 
        'hero', 'heroine', 'villain', 'setting', 'theme', 'motif', 'symbol', 'metaphor', 'simile', 
        'allegory', 'irony', 'satire', 'parody', 'genre', 'fiction', 'nonfiction', 'biography', 
        'autobiography', 'memoir', 'essay', 'article', 'journal', 'diary', 'letter', 'poem', 
        'poetry', 'verse', 'stanza', 'rhyme', 'rhythm', 'meter', 'sonnet', 'haiku', 'limerick', 
        'ballad', 'epic', 'ode', 'elegy', 'freeverse', 'prosepoetry', 'drama', 'play', 'theater', 
        'script', 'screenplay', 'dialogue', 'monologue', 'soliloquy', 'act', 'scene', 'stage', 
        'performance', 'actor', 'actress', 'director', 'producer', 'writer', 'author', 'poet', 
        'novelist', 'playwright', 'screenwriter', 'journalist', 'editor', 'publisher', 'literary', 
        'classic', 'canon', 'bestseller', 'award', 'prize', 'pulitzer', 'nobel', 'booker', 'critic', 
        'review', 'analysis', 'interpretation', 'criticism', 'theory', 'structuralism', 'postmodernism', 
        'modernism', 'romanticism', 'realism', 'naturalism', 'gothic', 'horror', 'thriller', 'mystery', 
        'crime', 'detective', 'noir', 'fantasy', 'sciencefiction', 'dystopia', 'utopia', 'adventure', 
        'romance', 'comedy', 'tragedy', 'historicalfiction', 'youngadult', 'children', 'picturebook', 
        'graphicnovel', 'comic', 'manga', 'anime', 'mythology', 'folklore', 'fable', 'parable', 
        'legend', 'epic', 'saga', 'chronicle', 'history', 'memoir', 'biography', 'autobiography'
    ],
    colors: [
        'red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet', 'purple', 'pink', 'white', 
        'black', 'gray', 'grey', 'brown', 'beige', 'tan', 'cream', 'ivory', 'silver', 'gold', 
        'bronze', 'copper', 'metallic', 'shiny', 'dull', 'matte', 'glossy', 'sheen', 'glow', 
        'bright', 'dark', 'light', 'pale', 'deep', 'rich', 'vibrant', 'muted', 'pastel', 'neon', 
        'fluorescent', 'iridescent', 'pearlescent', 'translucent', 'transparent', 'opaque', 'clear', 
        'cloudy', 'hazy', 'faded', 'washedout', 'bleached', 'tinted', 'shaded', 'shadowed', 
        'highlighted', 'accent', 'primary', 'secondary', 'tertiary', 'complementary', 'analogous', 
        'monochromatic', 'polychromatic', 'multicolor', 'rainbow', 'spectrum', 'hue', 'shade', 
        'tint', 'tone', 'saturation', 'value', 'chroma', 'intensity', 'warm', 'cool', 'neutral', 
        'earthtone', 'pasteltone', 'jeweltone', 'primarycolor', 'secondarycolor', 'colorwheel', 
        'colortheory', 'palette', 'scheme', 'harmony', 'contrast', 'balance', 'gradient', 
        'blend', 'mix', 'match', 'coordinate', 'dye', 'paint', 'pigment', 'stain', 'wash', 
        'glaze', 'varnish', 'finish', 'coat', 'layer', 'primer', 'base', 'undercoat', 'topcoat', 
        'enamel', 'lacquer', 'shellac', 'oil', 'acrylic', 'watercolor', 'gouache', 'tempera', 
        'fresco', 'mosaic', 'stainedglass', 'prism', 'refraction', 'reflection', 'absorption', 
        'scattering', 'diffusion', 'dispersion', 'spectrum', 'wavelength', 'frequency', 'light', 
        'colorblind', 'colorblind', 'achromatopsia', 'monochromacy', 'dichromacy', 'trichromacy'
    ],
    business: [
        'business', 'company', 'corporation', 'enterprise', 'firm', 'organization', 'startup', 
        'venture', 'partnership', 'soleproprietorship', 'llc', 'incorporated', 'limited', 'public', 
        'private', 'nonprofit', 'charity', 'foundation', 'trust', 'association', 'union', 'guild', 
        'syndicate', 'consortium', 'alliance', 'coalition', 'merger', 'acquisition', 'takeover', 
        'buyout', 'ipo', 'stock', 'share', 'equity', 'dividend', 'profit', 'revenue', 'income', 
        'sales', 'marketing', 'advertising', 'promotion', 'brand', 'branding', 'logo', 'slogan', 
        'campaign', 'strategy', 'tactic', 'plan', 'goal', 'objective', 'target', 'quota', 'budget', 
        'finance', 'accounting', 'audit', 'tax', 'fiscal', 'monetary', 'currency', 'money', 'cash', 
        'capital', 'investment', 'investor', 'venturecapital', 'angelinvestor', 'crowdfunding', 
        'loan', 'credit', 'debt', 'interest', 'rate', 'bank', 'banking', 'insurance', 'risk', 
        'management', 'leadership', 'executive', 'ceo', 'cfo', 'cto', 'coo', 'director', 'board', 
        'chairman', 'president', 'vicepresident', 'manager', 'supervisor', 'teamleader', 'employee', 
        'staff', 'workforce', 'personnel', 'hr', 'humanresources', 'recruitment', 'hiring', 
        'firing', 'layoff', 'retirement', 'pension', 'benefits', 'salary', 'wage', 'compensation', 
        'bonus', 'commission', 'incentive', 'perk', 'contract', 'agreement', 'negotiation', 'deal', 
        'contract', 'legal', 'lawyer', 'attorney', 'counsel', 'compliance', 'regulation', 'policy', 
        'procedure', 'protocol', 'standard', 'guideline', 'rule', 'code', 'ethics', 'integrity', 
        'transparency', 'accountability', 'responsibility', 'sustainability', 'corporate', 
        'socialresponsibility', 'esg', 'environmental', 'governance', 'stakeholder', 'shareholder'
    ],
    architecture: [
        'architecture', 'building', 'structure', 'design', 'blueprint', 'plan', 'sketch', 'drawing', 
        'foundation', 'base', 'floor', 'ceiling', 'roof', 'wall', 'window', 'door', 'entrance', 
        'column', 'pillar', 'beam', 'arch', 'dome', 'spire', 'tower', 'skyscraper', 'penthouse', 
        'apartment', 'condo', 'house', 'home', 'cottage', 'cabin', 'mansion', 'villa', 'palace', 
        'castle', 'fortress', 'temple', 'church', 'cathedral', 'mosque', 'synagogue', 'shrine', 
        'monument', 'statue', 'sculpture', 'fountain', 'bridge', 'tunnel', 'road', 'street', 
        'avenue', 'boulevard', 'lane', 'alley', 'plaza', 'square', 'park', 'garden', 'courtyard', 
        'patio', 'deck', 'balcony', 'terrace', 'porch', 'veranda', 'lobby', 'foyer', 'hallway', 
        'corridor', 'staircase', 'elevator', 'escalator', 'ramp', 'stairs', 'step', 'landing', 
        'room', 'chamber', 'hall', 'auditorium', 'theater', 'stadium', 'arena', 'coliseum', 
        'material', 'brick', 'stone', 'wood', 'steel', 'concrete', 'glass', 'metal', 'marble', 
        'granite', 'sand', 'gravel', 'cement', 'mortar', 'plaster', 'paint', 'tile', 'shingle', 
        'thatch', 'slate', 'roofing', 'flooring', 'carpet', 'hardwood', 'laminate', 'vinyl', 
        'insulation', 'plumbing', 'electrical', 'wiring', 'pipe', 'vent', 'duct', 'chimney', 
        'fireplace', 'heating', 'cooling', 'airconditioning', 'ventilation', 'lighting', 'fixture', 
        'lamp', 'chandelier', 'sconce', 'architect', 'engineer', 'contractor', 'builder', 
        'carpenter', 'mason', 'electrician', 'plumber', 'roofer', 'painter', 'designer'
    ],
    medicine: [
        'medicine', 'health', 'doctor', 'physician', 'nurse', 'surgeon', 'specialist', 'clinic', 
        'hospital', 'emergency', 'urgent', 'care', 'treatment', 'therapy', 'cure', 'heal', 'recover', 
        'patient', 'symptom', 'diagnosis', 'disease', 'illness', 'sickness', 'condition', 'disorder', 
        'infection', 'virus', 'bacteria', 'germ', 'microbe', 'parasite', 'fungus', 'mold', 
        'fever', 'pain', 'ache', 'hurt', 'injury', 'wound', 'cut', 'burn', 'bruise', 'scar', 
        'bandage', 'cast', 'splint', 'crutch', 'wheelchair', 'stretcher', 'gurney', 'bed', 
        'surgery', 'operation', 'procedure', 'incision', 'stitch', 'suture', 'anesthesia', 'sedative', 
        'medication', 'drug', 'medicine', 'pill', 'tablet', 'capsule', 'liquid', 'syrup', 'injection', 
        'shot', 'vaccine', 'immunization', 'antibiotic', 'antiviral', 'painkiller', 'analgesic', 
        'sedative', 'tranquilizer', 'stimulant', 'depressant', 'steroid', 'hormone', 'vitamin', 
        'supplement', 'mineral', 'nutrient', 'diet', 'nutrition', 'exercise', 'fitness', 'wellness', 
        'prevention', 'checkup', 'exam', 'test', 'screening', 'xray', 'mri', 'scan', 'ultrasound', 
        'blood', 'pressure', 'heart', 'rate', 'pulse', 'temperature', 'breathing', 'respiration', 
        'organ', 'tissue', 'cell', 'gene', 'dna', 'chromosome', 'mutation', 'genetics', 'heredity', 
        'pharmacy', 'pharmacist', 'prescription', 'dosage', 'dose', 'sideeffect', 'reaction', 
        'allergy', 'intolerance', 'sensitivity', 'immune', 'system', 'antibody', 'antigen', 'whiteblood', 
        'redblood', 'platelet', 'plasma', 'serum', 'donor', 'transplant', 'dialysis', 'oxygen'
    ],
    fashion: [
        'fashion', 'style', 'clothing', 'clothes', 'apparel', 'garment', 'outfit', 'ensemble', 
        'dress', 'shirt', 'blouse', 'top', 'tshirt', 'sweater', 'cardigan', 'jacket', 'coat', 
        'blazer', 'vest', 'pants', 'trousers', 'jeans', 'shorts', 'skirt', 'dress', 'gown', 
        'suit', 'tuxedo', 'uniform', 'costume', 'robe', 'cape', 'shawl', 'scarf', 'tie', 
        'belt', 'sash', 'suspenders', 'braces', 'underwear', 
        'boxers', 'briefs', 'socks', 'stockings', 'hose', 'tights', 'leggings', 'pantyhose', 
        'shoes', 'boots', 'sneakers', 'sandals', 'heels', 'flats', 'loafers', 'slippers', 
        'hat', 'cap', 'beanie', 'beret', 'fedora', 'bonnet', 'helmet', 'crown', 'tiara', 
        'jewelry', 'necklace', 'bracelet', 'ring', 'earring', 'pendant', 'brooch', 'pin', 
        'watch', 'glasses', 'sunglasses', 'handbag', 'purse', 'wallet', 'bag', 'backpack', 
        'suitcase', 'luggage', 'fabric', 'cloth', 'material', 'textile', 'cotton', 'wool', 
        'silk', 'linen', 'polyester', 'nylon', 'denim', 'leather', 'suede', 'velvet', 'lace', 
        'satin', 'chiffon', 'tulle', 'organza', 'cashmere', 'angora', 'mohair', 'tweed', 
        'plaid', 'striped', 'checked', 'polkadot', 'floral', 'pattern', 'print', 'color', 
        'dye', 'stain', 'bleach', 'wash', 'dry', 'clean', 'press', 'iron', 'steam', 'sew', 
        'stitch', 'hem', 'cuff', 'collar', 'sleeve', 'pocket', 'button', 'zipper', 'snap', 
        'hook', 'clasp', 'buckle', 'designer', 'brand', 'label', 'collection', 'season', 
        'trend', 'vogue', 'couture', 'runway', 'model', 'photographer', 'magazine', 'editor'
    ],
    gardening: [
        'garden', 'gardening', 'plant', 'flower', 'tree', 'bush', 'shrub', 'vine', 'grass', 
        'lawn', 'soil', 'dirt', 'earth', 'ground', 'land', 'yard', 'plot', 'bed', 'border', 
        'path', 'walkway', 'patio', 'deck', 'fence', 'gate', 'wall', 'trellis', 'arbor', 
        'pergola', 'shed', 'greenhouse', 'conservatory', 'sunroom', 'pot', 'container', 'box', 
        'planter', 'basket', 'trough', 'vase', 'urn', 'seed', 'seedling', 'sapling', 'bulb', 
        'tuber', 'rhizome', 'corm', 'root', 'stem', 'leaf', 'petal', 'blossom', 'bloom', 
        'flower', 'rose', 'tulip', 'daisy', 'lily', 'sunflower', 'daffodil', 'crocus', 'iris', 
        'orchid', 'hydrangea', 'lilac', 'lavender', 'rosemary', 'thyme', 'sage', 'mint', 
        'basil', 'parsley', 'cilantro', 'dill', 'chives', 'oregano', 'marjoram', 'tarragon', 
        'vegetable', 'fruit', 'tomato', 'pepper', 'carrot', 'onion', 'garlic', 'potato', 
        'lettuce', 'spinach', 'kale', 'cabbage', 'broccoli', 'cauliflower', 'peas', 'beans', 
        'corn', 'squash', 'pumpkin', 'melon', 'strawberry', 'raspberry', 'blueberry', 
        'apple', 'pear', 'peach', 'plum', 'cherry', 'grape', 'citrus', 'lemon', 'orange', 
        'lime', 'water', 'irrigation', 'hose', 'sprinkler', 'drip', 'mist', 'fountain', 
        'pond', 'pool', 'waterfall', 'stream', 'river', 'rock', 'stone', 'gravel', 'mulch', 
        'compost', 'fertilizer', 'manure', 'soil', 'amendment', 'lime', 'sulfur', 'nitrogen', 
        'phosphorus', 'potassium', 'pruning', 'trimming', 'cutting', 'shears', 'scissors', 
        'shovel', 'spade', 'trowel', 'rake', 'hoe', 'fork', 'mattock', 'pickaxe', 'saw', 
        'pruner', 'lopper', 'gloves', 'boots', 'hat', 'apron', 'wheelbarrow', 'cart'
    ],
    cooking: [
        'cooking', 'cook', 'chef', 'kitchen', 'recipe', 'dish', 'meal', 'food', 'cuisine', 
        'ingredient', 'spice', 'herb', 'seasoning', 'flavor', 'taste', 'salt', 'pepper', 
        'sugar', 'honey', 'syrup', 'sweet', 'sour', 'bitter', 'salty', 'savory', 'spicy', 
        'hot', 'mild', 'heat', 'temperature', 'boil', 'simmer', 'sauté', 'fry', 'deepfry', 
        'stirfry', 'grill', 'barbecue', 'roast', 'bake', 'broil', 'steam', 'poach', 'blanch', 
        'sauté', 'sear', 'brown', 'caramelize', 'glaze', 'marinate', 'season', 'rub', 'coat', 
        'dredge', 'batter', 'breading', 'crust', 'crisp', 'tender', 'juicy', 'moist', 'dry', 
        'burnt', 'overcooked', 'undercooked', 'raw', 'fresh', 'frozen', 'canned', 'dried', 
        'preserved', 'pickled', 'fermented', 'cured', 'smoked', 'aged', 'ripened', 'mature', 
        'meat', 'beef', 'pork', 'chicken', 'turkey', 'duck', 'lamb', 'goat', 'veal', 'fish', 
        'seafood', 'shellfish', 'shrimp', 'crab', 'lobster', 'clam', 'mussel', 'oyster', 
        'scallop', 'squid', 'octopus', 'vegetable', 'fruit', 'grain', 'rice', 'pasta', 
        'noodle', 'bread', 'dough', 'flour', 'yeast', 'baking', 'soda', 'powder', 'egg', 
        'milk', 'cream', 'butter', 'oil', 'fat', 'grease', 'lard', 'shortening', 'cheese', 
        'sauce', 'gravy', 'broth', 'stock', 'soup', 'stew', 'chili', 'curry', 'stirfry', 
        'salad', 'dressing', 'vinaigrette', 'mayonnaise', 'mustard', 'ketchup', 'relish', 
        'salsa', 'dip', 'spread', 'jam', 'jelly', 'preserves', 'honey', 'syrup', 'sugar', 
        'spice', 'herb', 'garlic', 'onion', 'ginger', 'cinnamon', 'nutmeg', 'clove', 
        'vanilla', 'extract', 'essence', 'flavor', 'aroma', 'smell', 'scent', 'perfume', 
        'pot', 'pan', 'skillet', 'wok', 'griddle', 'oven', 'stove', 'burner', 'range', 
        'microwave', 'blender', 'mixer', 'processor', 'grinder', 'chopper', 'slicer', 'peeler', 
        'grater', 'zester', 'knife', 'cutting', 'board', 'spoon', 'fork', 'knife', 'whisk', 
        'spatula', 'ladle', 'tongs', 'slotted', 'spoon', 'measuring', 'cup', 'scale', 'timer'
    ],
    transportation: [
        'transport', 'transportation', 'travel', 'journey', 'trip', 'voyage', 'expedition', 
        'commute', 'transit', 'passenger', 'driver', 'pilot', 'captain', 'crew', 'staff', 
        'vehicle', 'car', 'automobile', 'truck', 'van', 'bus', 'coach', 'minibus', 'taxi', 
        'cab', 'rideshare', 'uber', 'lyft', 'train', 'railway', 'railroad', 'subway', 'metro', 
        'tram', 'streetcar', 'trolley', 'light', 'rail', 'heavy', 'rail', 'locomotive', 'engine', 
        'plane', 'airplane', 'aircraft', 'airline', 'flight', 'airport', 'runway', 'terminal', 
        'gate', 'hangar', 'helicopter', 'chopper', 'jet', 'propeller', 'wing', 'cockpit', 
        'ship', 'boat', 'vessel', 'craft', 'ferry', 'cruise', 'liner', 'yacht', 'sailboat', 
        'sailing', 'sail', 'motorboat', 'speedboat', 'rowboat', 'canoe', 'kayak', 'raft', 
        'dinghy', 'skiff', 'barge', 'tugboat', 'container', 'cargo', 'freight', 'shipping', 
        'dock', 'pier', 'wharf', 'harbor', 'port', 'marina', 'anchorage', 'mooring', 
        'bicycle', 'bike', 'cycle', 'motorcycle', 'motorbike', 'scooter', 'moped', 'skateboard', 
        'rollerblade', 'scooter', 'electric', 'scooter', 'segway', 'walking', 'hike', 'run', 
        'jog', 'sprint', 'marathon', 'race', 'racing', 'speed', 'velocity', 'acceleration', 
        'brake', 'stop', 'go', 'start', 'engine', 'motor', 'fuel', 'gas', 'gasoline', 'petrol', 
        'diesel', 'electric', 'hybrid', 'battery', 'charge', 'charging', 'station', 'pump', 
        'fill', 'tank', 'gauge', 'meter', 'odometer', 'speedometer', 'dashboard', 'steering', 
        'wheel', 'tire', 'brake', 'pedal', 'gear', 'shift', 'clutch', 'transmission', 'drive', 
        'reverse', 'park', 'neutral', 'traffic', 'road', 'street', 'highway', 'freeway', 
        'expressway', 'interstate', 'route', 'path', 'way', 'lane', 'boulevard', 'avenue', 
        'intersection', 'junction', 'crossing', 'signal', 'light', 'sign', 'marking', 'line', 
        'sidewalk', 'crosswalk', 'zebra', 'bridge', 'overpass', 'underpass', 'tunnel', 'viaduct', 
        'flyover', 'roundabout', 'circle', 'rotary', 'traffic', 'circle', 'parking', 'lot', 'garage'
    ],
    education: [
        'education', 'school', 'learning', 'teach', 'teacher', 'student', 'pupil', 'class', 
        'lesson', 'course', 'subject', 'topic', 'curriculum', 'syllabus', 'program', 'degree', 
        'diploma', 'certificate', 'qualification', 'credential', 'exam', 'test', 'quiz', 
        'assessment', 'evaluation', 'grade', 'score', 'mark', 'pass', 'fail', 'credit', 
        'semester', 'term', 'quarter', 'trimester', 'year', 'academic', 'year', 'scholar', 
        'scholarship', 'grant', 'aid', 'financial', 'assistance', 'tuition', 'fee', 'cost', 
        'expense', 'budget', 'fund', 'money', 'university', 'college', 'institute', 'academy', 
        'faculty', 'department', 'school', 'major', 'minor', 'field', 'study', 'discipline', 
        'research', 'thesis', 'dissertation', 'paper', 'essay', 'report', 'project', 'assignment', 
        'homework', 'work', 'study', 'review', 'revise', 'learn', 'memorize', 'remember', 
        'understand', 'comprehend', 'grasp', 'know', 'knowledge', 'wisdom', 'insight', 
        'intelligence', 'intellect', 'mind', 'brain', 'thought', 'idea', 'concept', 'theory', 
        'hypothesis', 'experiment', 'lab', 'laboratory', 'science', 'math', 'mathematics', 
        'algebra', 'geometry', 'calculus', 'statistics', 'physics', 'chemistry', 'biology', 
        'history', 'geography', 'literature', 'language', 'english', 'foreign', 'art', 'music', 
        'physical', 'education', 'pe', 'gym', 'sports', 'athletics', 'library', 'book', 
        'textbook', 'notebook', 'pen', 'pencil', 'paper', 'desk', 'chair', 'classroom', 
        'lecture', 'hall', 'auditorium', 'campus', 'dorm', 'dormitory', 'residence', 'housing', 
        'cafeteria', 'canteen', 'dining', 'hall', 'principal', 'dean', 'headmaster', 
        'headmistress', 'professor', 'instructor', 'lecturer', 'tutor', 'mentor', 'advisor', 
        'counselor', 'guidance', 'counseling', 'career', 'job', 'work', 'profession', 
        'occupation', 'vocation', 'trade', 'skill', 'ability', 'talent', 'aptitude', 'potential', 
        'growth', 'development', 'progress', 'achievement', 'success', 'failure', 'challenge', 
        'opportunity', 'possibility', 'future', 'goal', 'objective', 'aim', 'purpose', 'ambition'
    ],
    hobbies: [
        'hobby', 'pastime', 'interest', 'passion', 'enthusiasm', 'leisure', 'recreation', 
        'activity', 'pursuit', 'craft', 'art', 'skill', 'talent', 'ability', 'creativity', 
        'imagination', 'inspiration', 'expression', 'painting', 'drawing', 'sketching', 
        'sculpture', 'pottery', 'ceramics', 'photography', 'videography', 'filmmaking', 
        'writing', 'reading', 'literature', 'poetry', 'prose', 'fiction', 'nonfiction', 
        'music', 'instrument', 'singing', 'dancing', 'performance', 'theater', 'drama', 
        'acting', 'gaming', 'video', 'game', 'esports', 'sports', 'athletics', 'fitness', 
        'exercise', 'yoga', 'meditation', 'mindfulness', 'cooking', 'baking', 'gardening', 
        'farming', 'fishing', 'hunting', 'camping', 'hiking', 'trekking', 'climbing', 
        'mountaineering', 'travel', 'exploration', 'adventure', 'sightseeing', 'tourism', 
        'collecting', 'collection', 'antiques', 'coins', 'stamps', 'cards', 'comics', 
        'toys', 'models', 'trains', 'dolls', 'figurines', 'memorabilia', 'souvenirs', 
        'knitting', 'crochet', 'sewing', 'embroidery', 'quilting', 'weaving', 'spinning', 
        'woodworking', 'carpentry', 'metalworking', 'blacksmithing', 'jewelry', 'making', 
        'beadwork', 'leatherwork', 'origami', 'paper', 'crafts', 'scrapbooking', 'calligraphy', 
        'puzzles', 'crossword', 'sudoku', 'jigsaw', 'brain', 'teasers', 'chess', 'board', 
        'games', 'card', 'games', 'roleplaying', 'dnd', 'dungeons', 'dragons', 'miniature', 
        'painting', 'warhammer', 'model', 'building', 'lego', 'robotics', 'electronics', 
        'programming', 'coding', 'hacking', 'maker', 'diy', 'crafts', 'home', 'improvement', 
        'renovation', 'decorating', 'design', 'interior', 'design', 'fashion', 'style', 
        'beauty', 'makeup', 'hair', 'styling', 'grooming', 'fitness', 'bodybuilding', 
        'running', 'cycling', 'swimming', 'surfing', 'skiing', 'snowboarding', 'skating', 
        'bowling', 'golf', 'tennis', 'badminton', 'squash', 'racket', 'sports', 'martial', 
        'arts', 'boxing', 'wrestling', 'fencing', 'archery', 'shooting', 'horseback', 'riding', 
        'equestrian', 'sailing', 'boating', 'kayaking', 'canoeing', 'rafting', 'scuba', 
        'diving', 'snorkeling', 'birdwatching', 'astronomy', 'stargazing', 'photography', 
        'videography', 'blogging', 'vlogging', 'podcasting', 'streaming', 'content', 'creation'
    ]
 };

// ==================== DIFFICULTY CONFIGURATION ====================
const DifficultyConfig = {
    easy: { gridSize: 8, wordCount: 5, directions: ['horizontal', 'vertical'], minWordLength: 3, maxWordLength: 6 },
    medium: { gridSize: 10, wordCount: 8, directions: ['horizontal', 'vertical', 'diagonal'], minWordLength: 4, maxWordLength: 8 },
    hard: { gridSize: 12, wordCount: 12, directions: ['horizontal', 'vertical', 'diagonal', 'backwards'], minWordLength: 5, maxWordLength: 10 },
    expert: { gridSize: 15, wordCount: 18, directions: ['horizontal', 'vertical', 'diagonal', 'backwards', 'diagonal-backwards'], minWordLength: 6, maxWordLength: 12 }
};

// ==================== PLAYER DATA ====================
let PlayerData = {
    level: 1,
    score: 0,
    totalScore: 0,
    netWorth: 0,
    puzzlesCompleted: 0,
    longestStreak: 0,
    currentStreak: 0,
    journeyLevel: 1,
    completedLevels: [],
    dailyStreak: 0,
    totalDailyCompleted: 0,
    lastDailyDate: null,
    previousStreak: 0,
    dailyCompletedToday: false,
    hintsUsed: 0,
    hintsRemaining: 5,
    maxHints: 5,
    hintRechargeStart: null,
    playtime: 0,
    settings: {
        musicVolume: 50,
        ambienceVolume: 70,
        uiVolume: 80,
        fullscreen: false,
        reducedMotion: false
    },
    ownedThemes: ['zen'],
    currentTheme: 'zen',
    usedPromoCodes: [],
    // League data
    leagueName: '',
    leagueCharms: 0,
    league: 'wood',
    leagueWeekStart: null,
    bots: [],
    // Gems currency
    gems: 0,
    totalGems: 0,
    // Streak ember
    streakEmber: 0,
    // Highest league rank
    highestLeague: null,
    highestLeagueRank: null
};

// ==================== LEAGUE CONFIGURATION ====================
const LeagueConfig = {
    wood: {
        name: 'Wood League',
        icon: '🪵',
        promotionSlots: 8,
        demotionSlots: 0,
        botMinDaily: 0,
        botMaxDaily: 0.05
    },
    stone: {
        name: 'Stone League',
        icon: '🪨',
        promotionSlots: 7,
        demotionSlots: 9,
        botMinDaily: 0,
        botMaxDaily: 0.1
    },
    bronze: {
        name: 'Bronze League',
        icon: '🥉',
        promotionSlots: 6,
        demotionSlots: 10,
        botMinDaily: 0,
        botMaxDaily: 0.15
    },
    silver: {
        name: 'Silver League',
        icon: '🥈',
        promotionSlots: 5,
        demotionSlots: 11,
        botMinDaily: 0,
        botMaxDaily: 0.2
    },
    gold: {
        name: 'Gold League',
        icon: '🥇',
        promotionSlots: 4,
        demotionSlots: 12,
        botMinDaily: 0,
        botMaxDaily: 0.25
    },
    emerald: {
        name: 'Emerald League',
        icon: '💚',
        promotionSlots: 3,
        demotionSlots: 13,
        botMinDaily: 0,
        botMaxDaily: 0.3
    },
    sapphire: {
        name: 'Sapphire League',
        icon: '💠',
        promotionSlots: 2,
        demotionSlots: 14,
        botMinDaily: 0,
        botMaxDaily: 0.4
    },
    ruby: {
        name: 'Ruby League',
        icon: '♦️',
        promotionSlots: 1,
        demotionSlots: 15,
        botMinDaily: 0,
        botMaxDaily: 0.6
    },
    diamond: {
        name: 'Diamond League',
        icon: '💎',
        promotionSlots: 0,
        demotionSlots: 25,
        botMinDaily: 0,
        botMaxDaily: 0.85
    }
};

const BotNames = [
    'ZenMaster', 'WordWizard', 'PuzzlePro', 'Charmer', 'WordSmith',
    'Lexicon', 'VocabViking', 'WordWarrior', 'PuzzleKing', 'CharmsChamp',
    'WordNinja', 'PuzzleQueen', 'LexLord', 'WordWhiz', 'CharmMaster',
    'PuzzlePaladin', 'WordKnight', 'CharmHero', 'WordSage', 'PuzzlePrince',
    'LexLegend', 'WordWizard', 'CharmChief', 'PuzzlePioneer', 'WordWarden',
    'CharmCaptain', 'WordWarlord', 'PuzzlePatriarch', 'LexLegend', 'WordWiz',
    'CharmCommander', 'PuzzleProdigy', 'WordWhisperer', 'CharmChampion', 'WordWanderer'
];

const LeagueChestRewards = {
    wood: { 1: 20, 2: 15, 3: 10 },
    stone: { 1: 25, 2: 20, 3: 15 },
    bronze: { 1: 30, 2: 25, 3: 20 },
    silver: { 1: 35, 2: 30, 3: 25 },
    gold: { 1: 40, 2: 35, 3: 30 },
    emerald: { 1: 45, 2: 40, 3: 35 },
    sapphire: { 1: 50, 2: 45, 3: 40 },
    ruby: { 1: 55, 2: 50, 3: 45 },
    diamond: { 1: 60, 2: 55, 3: 50 }
};

// ==================== AUDIO SYSTEM ====================
const AudioSystem = {
    bgMusic: null,
    correctSound: null,
    incorrectSound: null,
    uiSound: null,
    
    init() {
        this.bgMusic = document.getElementById('bg-music');
        this.correctSound = document.getElementById('correct-sound');
        this.incorrectSound = document.getElementById('incorrect-sound');
        this.uiSound = document.getElementById('ui-sound');
        
        this.updateVolumes();
        
        // Try to play music immediately, but handle autoplay restriction
        this.playMusic();
        
        // Also try to play on first user interaction
        document.addEventListener('click', () => this.playMusic(), { once: true });
        document.addEventListener('keydown', () => this.playMusic(), { once: true });
    },
    
    updateVolumes() {
        if (this.bgMusic) {
            this.bgMusic.volume = PlayerData.settings.musicVolume / 100;
        }
        if (this.correctSound) {
            this.correctSound.volume = PlayerData.settings.uiVolume / 100;
        }
        if (this.incorrectSound) {
            this.incorrectSound.volume = PlayerData.settings.uiVolume / 100;
        }
        if (this.uiSound) {
            this.uiSound.volume = PlayerData.settings.uiVolume / 100;
        }
    },
    
    playMusic() {
        if (this.bgMusic) {
            this.bgMusic.loop = true;
            // Set volume first
            this.bgMusic.volume = PlayerData.settings.musicVolume / 100;
            
            // Try to play music regardless of volume setting (user can adjust in settings)
            this.bgMusic.play().catch(e => {
                console.log('Audio play failed:', e);
                // Retry on next user interaction
                const playOnInteraction = () => {
                    this.bgMusic.play().catch(err => console.log('Retry failed:', err));
                };
                document.addEventListener('click', playOnInteraction, { once: true });
                document.addEventListener('keydown', playOnInteraction, { once: true });
            });
        }
    },
    
    stopMusic() {
        // Music plays constantly 24/7 - never stop
    },
    
    playCorrect() {
        if (this.correctSound && PlayerData.settings.uiVolume > 0) {
            this.correctSound.currentTime = 0;
            this.correctSound.play().catch(e => console.log('Audio play failed:', e));
        }
    },
    
    playIncorrect() {
        if (this.incorrectSound && PlayerData.settings.uiVolume > 0) {
            this.incorrectSound.currentTime = 0;
            this.incorrectSound.play().catch(e => console.log('Audio play failed:', e));
        }
    },
    
    playUI() {
        if (this.uiSound && PlayerData.settings.uiVolume > 0) {
            this.uiSound.currentTime = 0;
            this.uiSound.play().catch(e => console.log('Audio play failed:', e));
        }
    },
    
    loadThemeAudio() {
        const theme = PlayerData.currentTheme || 'zen';
        const prefix = theme === 'zen' ? 'zen_' : 'zen_' + theme + '_';
        
        // Wild theme uses .ogg for music and correct, .mp3 for others
        // Other themes use .mp3 for all sounds
        const musicExt = theme === 'wild' ? '.ogg' : '.mp3';
        const correctExt = theme === 'wild' ? '.ogg' : '.mp3';
        const otherExt = '.mp3';
        
        // Update audio file paths based on theme
        this.bgMusic.src = prefix + 'music' + musicExt;
        this.correctSound.src = prefix + 'correct' + correctExt;
        this.incorrectSound.src = prefix + 'incorrect' + otherExt;
        this.uiSound.src = prefix + 'ui' + otherExt;
        
        // Reload if music is playing
        if (!this.bgMusic.paused) {
            this.bgMusic.load();
            this.playMusic();
        }
    }
};

// ==================== LOCAL STORAGE ====================
function saveData() {
    try {
        localStorage.setItem('zenwords_player', JSON.stringify(PlayerData));
    } catch (e) {
        console.log('Failed to save data:', e);
    }
}

function loadData() {
    try {
        const saved = localStorage.getItem('zenwords_player');
        console.log('Loading data from localStorage:', saved ? 'Found' : 'Not found');
        if (saved) {
            const parsed = JSON.parse(saved);
            PlayerData = { ...PlayerData, ...parsed };
            console.log('Loaded PlayerData:', PlayerData);
            
            // Ensure maxHints is set
            if (!PlayerData.maxHints) {
                PlayerData.maxHints = 5;
            }
            
            // Ensure theme fields are set
            if (!PlayerData.ownedThemes) {
                PlayerData.ownedThemes = ['zen'];
            }
            if (!PlayerData.currentTheme) {
                PlayerData.currentTheme = 'zen';
            }
            if (!PlayerData.usedPromoCodes) {
                PlayerData.usedPromoCodes = [];
            }
            
            // Restore hint recharge state
            if (PlayerData.hintsRemaining < PlayerData.maxHints && PlayerData.hintRechargeStart) {
                const elapsed = Date.now() - PlayerData.hintRechargeStart;
                const hintsRecharged = Math.floor(elapsed / GameState.hintRechargeTime);
                PlayerData.hintsRemaining = Math.min(PlayerData.maxHints, PlayerData.hintsRemaining + hintsRecharged);
                if (hintsRecharged > 0) {
                    PlayerData.hintRechargeStart = Date.now() - (elapsed % GameState.hintRechargeTime);
                }
            }
            
            console.log('After loading - hintsRemaining:', PlayerData.hintsRemaining, 'hintRechargeStart:', PlayerData.hintRechargeStart);
            
            // Sync hintsRemaining with GameState
            GameState.hintsRemaining = PlayerData.hintsRemaining;
            GameState.hintRechargeStart = PlayerData.hintRechargeStart;
            
            // Sync playtime with GameState
            GameState.playtime = PlayerData.playtime;
        }
    } catch (e) {
        console.log('Failed to load data:', e);
    }
}

// ==================== SCREEN MANAGEMENT ====================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
    GameState.currentScreen = screenId;
    AudioSystem.playUI();
    
    // Header is constant 24/7 on all screens
    const header = document.querySelector('.permanent-header');
    header.style.display = 'flex';
    
    // Show/hide back button and pause button based on screen
    const backBtn = document.getElementById('header-back-btn');
    const pauseBtn = document.getElementById('pause-btn');
    
    if (screenId === 'main-menu') {
        backBtn.style.display = 'none';
        pauseBtn.style.display = 'none';
        updateHeaderForMenu();
    } else if (screenId === 'game-screen') {
        backBtn.style.display = 'block';
        pauseBtn.style.display = 'block';
    } else {
        backBtn.style.display = 'block';
        pauseBtn.style.display = 'none';
        updateHeaderForMenu();
    }
}

// ==================== MENU FUNCTIONS ====================
function startJourneyMode() {
    showJourneyMap();
}

function showJourneyMap() {
    GameState.gameMode = 'journey';
    renderJourneyMap();
    showScreen('journey-map-screen');
}

function startEndlessMode() {
    GameState.gameMode = 'endless';
    showScreen('difficulty-screen');
}

function startDailyPuzzle() {
    const now = new Date();
    const day = now.getUTCDate();
    const month = now.getUTCMonth() + 1; // Months are 0-indexed
    const year = now.getUTCFullYear();
    
    // Create seed string in day month year format (e.g., 5262026 for May 5th 2026)
    const seedString = `${day}${month}${year}`;
    
    GameState.gameMode = 'daily';
    GameState.dailySeed = seedString;
    GameState.difficulty = 'expert';
    
    // Check if there's saved progress for today's daily puzzle
    if (PlayerData.dailyProgress && PlayerData.dailyProgress.seed === seedString) {
        // Load saved progress
        loadDailyProgress();
        showScreen('game-screen');
        startTimer();
        updateHeaderDisplay();
        showDailyCountdown();
        return;
    }
    
    // Check if already completed today
    if (PlayerData.dailyCompletedToday) {
        // Load saved progress to view completed puzzle
        if (PlayerData.dailyProgress && PlayerData.dailyProgress.seed === seedString) {
            loadDailyProgress();
            GameState.isReadOnly = true;
            showScreen('game-screen');
            updateHeaderDisplay();
            showDailyCountdown();
            return;
        }
        // If no saved progress, generate and mark as read-only
        GameState.dailySeed = seedString;
        generatePuzzle(GameState.dailySeed);
        GameState.isReadOnly = true;
        showScreen('game-screen');
        updateHeaderDisplay();
        showDailyCountdown();
        return;
    }
    
    generatePuzzle(GameState.dailySeed);
    showScreen('game-screen');
    startTimer();
    updateHeaderDisplay();
    showDailyCountdown();
}

function showDailyCountdown() {
    document.getElementById('daily-header-timer').style.display = 'inline-block';
    document.getElementById('daily-countdown').style.display = 'none';
    updateDailyCountdown();
}

function updateDailyCountdown() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    
    const diff = tomorrow - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    const headerTimerEl = document.getElementById('daily-header-timer');
    if (headerTimerEl) {
        headerTimerEl.textContent = `Next Daily: ${hours}h ${minutes}m`;
    }
}

function loadDailyProgress() {
    const progress = PlayerData.dailyProgress;
    GameState.dailySeed = progress.seed;
    GameState.grid = progress.grid;
    GameState.words = progress.words;
    GameState.foundWords = progress.foundWords;
    GameState.wordPositions = progress.wordPositions;
    GameState.score = progress.score;
    GameState.combo = progress.combo;
    GameState.timer = progress.timer;
    GameState.gridSize = progress.gridSize;
    GameState.gridWidth = progress.gridWidth;
    GameState.gridHeight = progress.gridHeight;
    
    renderGrid();
    renderWordList();
    
    // Highlight found words on the grid
    progress.foundWords.forEach(word => {
        markWordAsFound(word);
    });
}

function saveDailyProgress() {
    if (GameState.gameMode === 'daily' && !GameState.isReadOnly && !PlayerData.dailyCompletedToday) {
        const now = new Date();
        const day = now.getUTCDate();
        const month = now.getUTCMonth() + 1;
        const year = now.getUTCFullYear();
        const seedString = `${day}${month}${year}`;
        
        PlayerData.dailyProgress = {
            seed: seedString,
            grid: GameState.grid,
            words: GameState.words,
            foundWords: GameState.foundWords,
            wordPositions: GameState.wordPositions,
            score: GameState.score,
            combo: GameState.combo,
            timer: GameState.timer,
            gridSize: GameState.gridSize,
            gridWidth: GameState.gridWidth,
            gridHeight: GameState.gridHeight
        };
        saveData();
    }
}

function selectDifficulty(difficulty) {
    GameState.difficulty = difficulty;
    showScreen('category-screen');
}

function selectCategory(category) {
    GameState.selectedCategory = category;
    showScreen('loading-screen');
    
    // Use setTimeout to allow the loading screen to render before generating puzzle
    setTimeout(() => {
        generatePuzzle();
        showScreen('game-screen');
        startTimer();
        updateHeaderDisplay();
    }, 100);
}

function closeDifficulty() {
    showScreen('main-menu');
}

function showMarket() {
    showScreen('market-screen');
    updateMarketDisplay();
}

function closeMarket() {
    showScreen('main-menu');
}

function updateMarketDisplay() {
    // Update gems display
    document.getElementById('market-score').textContent = PlayerData.gems.toLocaleString();
    
    // Update theme buttons based on ownership
    const themePrices = {
        forest: 20,
        space: 50,
        city: 100,
        ocean: 200
    };
    
    // Update streak ember button state
    const streakEmberBtn = document.getElementById('streak-ember-btn');
    if (streakEmberBtn) {
        if (PlayerData.streakEmber >= 1) {
            if (PlayerData.dailyStreak === 0) {
                streakEmberBtn.disabled = false;
                streakEmberBtn.textContent = 'Use Streak Ember';
            } else {
                streakEmberBtn.disabled = true;
                streakEmberBtn.textContent = 'Owned';
            }
        } else {
            streakEmberBtn.disabled = false;
            streakEmberBtn.textContent = 'Buy';
        }
    }
    
    document.querySelectorAll('.theme-item').forEach(item => {
        const theme = item.getAttribute('data-theme');
        const btn = item.querySelector('.theme-btn');
        
        if (PlayerData.ownedThemes.includes(theme)) {
            if (PlayerData.currentTheme === theme) {
                btn.textContent = 'Equipped';
                btn.disabled = true;
                btn.style.opacity = '0.5';
            } else {
                btn.textContent = 'Equip';
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        } else {
            btn.textContent = 'Buy';
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    });
}

function buyHint() {
    if (PlayerData.gems >= 5) {
        PlayerData.gems -= 5;
        PlayerData.hintsRemaining++;
        if (PlayerData.hintsRemaining > PlayerData.maxHints) {
            PlayerData.maxHints = PlayerData.hintsRemaining;
        }
        GameState.hintsRemaining = PlayerData.hintsRemaining;
        saveData();
        updateMainMenuDisplay();
        updateHintDisplay();
        updateMarketDisplay();
        alert('Hint purchased successfully!');
    } else {
        alert('Not enough gems! You need 5 gems.');
    }
}

function buyTheme(theme) {
    const themePrices = {
        forest: 20,
        space: 50,
        city: 100,
        ocean: 200
    };
    
    const price = themePrices[theme];
    
    if (PlayerData.ownedThemes.includes(theme)) {
        selectTheme(theme);
        return;
    }
    
    if (PlayerData.gems >= price) {
        PlayerData.gems -= price;
        PlayerData.ownedThemes.push(theme);
        saveData();
        updateMainMenuDisplay();
        updateMarketDisplay();
        alert(`${theme.charAt(0).toUpperCase() + theme.slice(1)} theme purchased successfully!`);
    } else {
        alert(`Not enough gems! You need ${price} gems.`);
    }
}

function buyStreakEmber() {
    if (PlayerData.streakEmber >= 1) {
        // Use streak ember to restore previous streak
        if (PlayerData.dailyStreak === 0 && PlayerData.previousStreak > 0) {
            PlayerData.dailyStreak = PlayerData.previousStreak;
            PlayerData.streakEmber--;
            PlayerData.previousStreak = 0;
            saveData();
            alert('Streak ember used! Streak restored to ' + PlayerData.dailyStreak);
            updateMainMenuDisplay();
            updateMarketDisplay();
        } else {
            alert('Cannot use streak ember - you have an active streak');
        }
    } else {
        // Buy streak ember
        if (PlayerData.gems >= 25) {
            PlayerData.gems -= 25;
            PlayerData.streakEmber++;
            saveData();
            updateMainMenuDisplay();
            updateMarketDisplay();
            alert('Streak Ember purchased successfully!');
        } else {
            alert('Not enough gems! You need 25 gems.');
        }
    }
}

function selectTheme(theme) {
    if (!PlayerData.ownedThemes.includes(theme)) {
        alert('You need to purchase this theme first!');
        return;
    }
    
    PlayerData.currentTheme = theme;
    saveData();
    
    // Apply theme CSS class to body
    document.body.className = theme === 'zen' ? '' : 'theme-' + theme;
    
    // Reload audio with new theme files
    AudioSystem.loadThemeAudio();
    
    // Start music immediately on loop
    if (AudioSystem.bgMusic) {
        AudioSystem.bgMusic.loop = true;
        AudioSystem.bgMusic.play().catch(e => console.log('Audio play failed:', e));
    }
    
    updateMarketDisplay();
    alert(`${theme.charAt(0).toUpperCase() + theme.slice(1)} theme equipped!`);
}

function redeemPromoCode() {
    const input = document.getElementById('promo-input');
    const code = input.value.toUpperCase();
    
    if (code.length !== 6) {
        alert('Please enter a 6-digit code.');
        return;
    }
    
    if (PlayerData.usedPromoCodes.includes(code)) {
        alert('This promo code has already been used.');
        return;
    }
    
    // Check if code contains 5, 6, and V
    if (code.includes('5') && code.includes('6') && code.includes('V')) {
        PlayerData.totalScore += 25000;
        PlayerData.netWorth += 25000;
        PlayerData.usedPromoCodes.push(code);
        saveData();
        updateMainMenuDisplay();
        input.value = '';
        alert('Promo code redeemed! +25,000 charms');
    } else {
        alert('Invalid promo code.');
    }
}

function showSettings() {
    showScreen('settings-screen');
    loadSettings();
}

function closeSettings() {
    showScreen('main-menu');
}

function showStatistics() {
    showScreen('statistics-screen');
    updateStatisticsDisplay();
}

function closeStatistics() {
    showScreen('main-menu');
}

function showLeague() {
    initializeLeague();
    showScreen('league-screen');
    updateLeagueDisplay();
}

function closeLeague() {
    showScreen('main-menu');
}

function savePlayerName() {
    const nameInput = document.getElementById('player-name-input');
    const name = nameInput.value.trim();
    if (name) {
        PlayerData.leagueName = name;
        saveData();
        updateLeagueDisplay();
        nameInput.value = '';
    }
}

function initializeLeague() {
    // Initialize league week if not set
    if (!PlayerData.leagueWeekStart) {
        PlayerData.leagueWeekStart = Date.now();
    }
    
    // Initialize bots if not set
    if (PlayerData.bots.length === 0) {
        initializeBots();
    } else {
        // Calculate offline charm gains for existing bots
        calculateOfflineBotGains();
    }
    
    // Load player name into input
    document.getElementById('player-name-input').value = PlayerData.leagueName;
}

function calculateOfflineBotGains() {
    const config = LeagueConfig[PlayerData.league] || LeagueConfig.wood;
    const now = Date.now();
    
    PlayerData.bots.forEach(bot => {
        // Ensure bot has required properties
        if (!bot.lastUpdate) {
            bot.lastUpdate = now;
        }
        
        // Calculate offline gains based on seconds passed
        const timeSinceLastUpdate = now - bot.lastUpdate;
        const secondsPassed = Math.floor(timeSinceLastUpdate / 1000);
        
        if (secondsPassed > 0) {
            // Each second, bot gains a random amount within league range (decimal)
            let totalGain = 0;
            for (let i = 0; i < secondsPassed; i++) {
                const gain = Math.random() * (config.botMaxDaily - config.botMinDaily) + config.botMinDaily;
                totalGain += gain;
            }
            
            // Only add the integer part to charms, keep decimal as invisible stat
            bot.charms += Math.floor(totalGain);
            
            bot.lastUpdate = now;
        }
    });
    
    saveData();
}

function initializeBots() {
    const shuffledNames = [...BotNames].sort(() => Math.random() - 0.5);
    const now = Date.now();
    PlayerData.bots = shuffledNames.slice(0, 29).map((name, index) => ({
        name: name,
        charms: 0,
        lastUpdate: now
    }));
    saveData();
}

function updateLeagueDisplay() {
    const config = LeagueConfig[PlayerData.league] || LeagueConfig.wood;
    
    // Update league header
    document.getElementById('league-icon').textContent = config.icon;
    document.getElementById('league-name').textContent = config.name;
    
    // Update timer
    updateLeagueTimer();
    
    // Render leaderboard
    renderLeaderboard();
}

function updateLeagueTimer() {
    const now = Date.now();
    const weekStart = PlayerData.leagueWeekStart || now;
    const weekEnd = weekStart + (3 * 24 * 60 * 60 * 1000); // 3 days in milliseconds
    const remaining = weekEnd - now;
    
    if (remaining <= 0) {
        // Week ended, reset league
        resetLeagueWeek();
        return;
    }
    
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    
    document.getElementById('league-timer').textContent = `${days}d ${hours}h ${minutes}m`;
}

function refreshLeague() {
    const config = LeagueConfig[PlayerData.league] || LeagueConfig.wood;
    
    PlayerData.bots.forEach(bot => {
        // Ensure bot has required properties
        if (!bot.lastUpdate) {
            bot.lastUpdate = Date.now();
        }
        
        // Add random charms based on league range (simulate 1 second of progress)
        const gain = Math.random() * (config.botMaxDaily - config.botMinDaily) + config.botMinDaily;
        bot.charms += Math.floor(gain);
    });
    
    saveData();
    renderLeaderboard();
}

function renderLeaderboard() {
    const leaderboard = document.getElementById('leaderboard');
    leaderboard.innerHTML = '';
    
    // Combine player and bots
    const allPlayers = [
        {
            name: PlayerData.leagueName || 'You',
            charms: PlayerData.leagueCharms,
            isUser: true
        },
        ...PlayerData.bots.map(bot => ({
            name: bot.name,
            charms: bot.charms,
            isUser: false
        }))
    ];
    
    // Sort by charms descending
    allPlayers.sort((a, b) => b.charms - a.charms);
    
    const config = LeagueConfig[PlayerData.league] || LeagueConfig.wood;
    
    allPlayers.forEach((player, index) => {
        const rank = index + 1;
        const item = document.createElement('div');
        item.className = `leaderboard-item rank-${rank} ${player.isUser ? 'is-user' : ''}`;
        
        item.innerHTML = `
            <span class="leaderboard-rank">#${rank}</span>
            <span class="leaderboard-name">${player.name}</span>
            <span class="leaderboard-charms">${player.charms.toLocaleString()}</span>
        `;
        
        leaderboard.appendChild(item);
        
        // Add promotion line after promotion slots
        if (rank === config.promotionSlots && config.promotionSlots > 0) {
            const promotionLine = document.createElement('div');
            promotionLine.className = 'promotion-line';
            leaderboard.appendChild(promotionLine);
        }
        
        // Add demotion line before demotion zone
        if (rank === (30 - config.demotionSlots) && config.demotionSlots > 0) {
            const demotionLine = document.createElement('div');
            demotionLine.className = 'demotion-line';
            leaderboard.appendChild(demotionLine);
        }
    });
}

function addCharmsToLeague(charms) {
    PlayerData.leagueCharms += charms;
    saveData();
    
    // Update leaderboard if league screen is visible
    const leagueScreen = document.getElementById('league-screen');
    if (leagueScreen && leagueScreen.style.display !== 'none') {
        renderLeaderboard();
    }
}

function resetLeagueWeek() {
    // Check if player should be promoted or demoted
    const allPlayers = [
        {
            name: PlayerData.leagueName || 'You',
            charms: PlayerData.leagueCharms,
            isUser: true
        },
        ...PlayerData.bots.map(bot => ({
            name: bot.name,
            charms: bot.charms,
            isUser: false
        }))
    ];
    
    allPlayers.sort((a, b) => b.charms - a.charms);
    
    const playerRank = allPlayers.findIndex(p => p.isUser) + 1;
    const config = LeagueConfig[PlayerData.league] || LeagueConfig.wood;
    
    // Update highest league rank if this is the first completed week
    if (!PlayerData.highestLeague || !PlayerData.highestLeagueRank) {
        PlayerData.highestLeague = PlayerData.league;
        PlayerData.highestLeagueRank = playerRank;
    } else {
        // Update if current league is higher than previous highest
        const leagueOrder = ['wood', 'stone', 'bronze', 'silver', 'gold', 'emerald', 'sapphire', 'ruby', 'diamond'];
        const currentIndex = leagueOrder.indexOf(PlayerData.league);
        const highestIndex = leagueOrder.indexOf(PlayerData.highestLeague);
        
        if (currentIndex > highestIndex) {
            PlayerData.highestLeague = PlayerData.league;
            PlayerData.highestLeagueRank = playerRank;
        } else if (currentIndex === highestIndex && playerRank < PlayerData.highestLeagueRank) {
            PlayerData.highestLeagueRank = playerRank;
        }
    }
    
    // Check promotion and award chest reward
    if (playerRank <= config.promotionSlots && config.promotionSlots > 0) {
        const leagueOrder = ['wood', 'stone', 'bronze', 'silver', 'gold', 'emerald', 'sapphire', 'ruby', 'diamond'];
        const currentIndex = leagueOrder.indexOf(PlayerData.league);
        
        // Award chest reward based on rank
        const chestRewards = LeagueChestRewards[PlayerData.league] || {};
        const reward = chestRewards[playerRank] || 0;
        
        if (reward > 0) {
            PlayerData.gems += reward;
            PlayerData.totalGems += reward;
            alert(`🎁 Promotion! You earned ${reward} gems for placing #${playerRank} in ${config.name}!`);
        }
        
        if (currentIndex < leagueOrder.length - 1) {
            PlayerData.league = leagueOrder[currentIndex + 1];
        }
    }
    
    // Check demotion
    if (playerRank > (30 - config.demotionSlots) && config.demotionSlots > 0) {
        const leagueOrder = ['wood', 'stone', 'bronze', 'silver', 'gold', 'emerald', 'sapphire', 'ruby', 'diamond'];
        const currentIndex = leagueOrder.indexOf(PlayerData.league);
        if (currentIndex > 0) {
            PlayerData.league = leagueOrder[currentIndex - 1];
        }
    }
    
    // If staying in same league (not promoted or demoted), just reset timer
    // This is the default behavior - no league change needed
    
    // Reset charms for new week
    PlayerData.leagueCharms = 0;
    PlayerData.bots.forEach(bot => {
        bot.charms = 0;
        bot.lastUpdate = Date.now();
    });
    
    // Set new week start
    PlayerData.leagueWeekStart = Date.now();
    
    saveData();
    updateLeagueDisplay();
}

function startLeagueTimer() {
    if (GameState.leagueTimerInterval) {
        clearInterval(GameState.leagueTimerInterval);
    }
    
    GameState.leagueTimerInterval = setInterval(() => {
        updateBotCharms();
        updateLeagueTimer();
    }, 1000); // Update every second
}

function updateBotCharms() {
    const config = LeagueConfig[PlayerData.league] || LeagueConfig.wood;
    
    PlayerData.bots.forEach(bot => {
        // Each bot gains a random amount of charms per second based on league (decimal)
        const gain = Math.random() * (config.botMaxDaily - config.botMinDaily) + config.botMinDaily;
        // Only add the integer part to charms, keep decimal as invisible stat
        bot.charms += Math.floor(gain);
    });
    
    saveData();
    
    // Update leaderboard if league screen is visible
    const leagueScreen = document.getElementById('league-screen');
    if (leagueScreen && leagueScreen.style.display !== 'none') {
        renderLeaderboard();
    }
}

function returnToMenu() {
    stopTimer();
    
    // Save daily progress if in daily mode
    if (GameState.gameMode === 'daily') {
        saveDailyProgress();
    }
    
    GameState.isReadOnly = false;
    showScreen('main-menu');
    updateMainMenuDisplay();
}

// ==================== JOURNEY MAP ====================
function renderJourneyMap() {
    const journeyPath = document.getElementById('journey-path');
    journeyPath.innerHTML = '';
    
    // Show all 1000 levels
    for (let level = 1; level <= 1000; level++) {
        const tier = Math.ceil(level / 10);
        const tierConfig = JourneyTiers[tier - 1];
        
        const node = document.createElement('div');
        node.className = 'level-node';
        
        // Determine node state
        if (level < PlayerData.journeyLevel) {
            node.classList.add('completed');
        } else if (level === PlayerData.journeyLevel) {
            node.classList.add('current');
        } else {
            node.classList.add('locked');
        }
        
        node.innerHTML = `
            <span class="level-number">${level}</span>
            <span class="level-tier">T${tier}</span>
        `;
        
        node.onclick = () => {
            if (level === PlayerData.journeyLevel) {
                startJourneyLevel(level);
            }
        };
        
        journeyPath.appendChild(node);
        
        if (level < 1000) {
            const line = document.createElement('div');
            line.className = 'path-line';
            journeyPath.appendChild(line);
        }
    }
    
    setTimeout(() => {
        const currentNode = journeyPath.querySelector('.level-node.current');
        if (currentNode) {
            currentNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

function startJourneyLevel(level) {
    GameState.currentLevel = level;
    GameState.gameMode = 'journey';
    
    // Get tier configuration
    const tier = Math.ceil(level / 10);
    const tierConfig = JourneyTiers[tier - 1];
    
    // Use tier configuration instead of difficulty
    GameState.gridWidth = tierConfig.gridWidth;
    GameState.gridHeight = tierConfig.gridHeight;
    GameState.gridSize = Math.max(tierConfig.gridWidth, tierConfig.gridHeight);
    
    generateJourneyPuzzle(tierConfig);
    showScreen('game-screen');
    startTimer();
    updateHeaderDisplay();
}

// ==================== SETTINGS ====================
function loadSettings() {
    document.getElementById('music-volume').value = PlayerData.settings.musicVolume;
    document.getElementById('ambience-volume').value = PlayerData.settings.ambienceVolume;
    document.getElementById('ui-volume').value = PlayerData.settings.uiVolume;
    document.getElementById('fullscreen-toggle').checked = PlayerData.settings.fullscreen;
    document.getElementById('reduced-motion').checked = PlayerData.settings.reducedMotion;
}

function updateSettings() {
    PlayerData.settings.musicVolume = parseInt(document.getElementById('music-volume').value);
    PlayerData.settings.ambienceVolume = parseInt(document.getElementById('ambience-volume').value);
    PlayerData.settings.uiVolume = parseInt(document.getElementById('ui-volume').value);
    PlayerData.settings.reducedMotion = document.getElementById('reduced-motion').checked;
    
    AudioSystem.updateVolumes();
    applyReducedMotion();
    saveData();
}

function resetSaveFile() {
    if (confirm('Are you sure you want to reset your progress? This will reset journey mode, streaks, score, playtime, hints, and puzzles completed. This cannot be undone.')) {
        // Reset specific values to defaults
        PlayerData.journeyLevel = 1;
        PlayerData.completedLevels = [];
        PlayerData.dailyStreak = 0;
        PlayerData.longestStreak = 0;
        PlayerData.playtime = 0;
        PlayerData.score = 0;
        PlayerData.totalScore = 0;
        PlayerData.netWorth = 0;
        PlayerData.puzzlesCompleted = 0;
        PlayerData.hintsRemaining = 5;
        PlayerData.hintRechargeStart = null;
        PlayerData.hintsUsed = 0;
        PlayerData.totalDailyCompleted = 0;
        PlayerData.lastDailyDate = null;
        PlayerData.previousStreak = 0;
        PlayerData.dailyCompletedToday = false;
        PlayerData.dailyProgress = null;
        PlayerData.ownedThemes = ['zen'];
        PlayerData.currentTheme = 'zen';
        PlayerData.usedPromoCodes = [];
        
        // Reset league data
        PlayerData.leagueName = '';
        PlayerData.leagueCharms = 0;
        PlayerData.league = 'wood';
        PlayerData.leagueWeekStart = null;
        PlayerData.bots = [];
        
        // Reset gems
        PlayerData.gems = 0;
        PlayerData.totalGems = 0;
        PlayerData.streakEmber = 0;
        PlayerData.highestLeague = null;
        PlayerData.highestLeagueRank = null;
        
        // Keep settings (music volume, etc.)
        
        // Save the reset data
        saveData();
        
        // Sync with GameState
        GameState.hintsRemaining = PlayerData.hintsRemaining;
        GameState.hintRechargeStart = PlayerData.hintRechargeStart;
        GameState.playtime = PlayerData.playtime;
        
        // Reload the application
        location.reload();
    }
}

function toggleFullscreen() {
    PlayerData.settings.fullscreen = document.getElementById('fullscreen-toggle').checked;
    if (PlayerData.settings.fullscreen) {
        document.documentElement.requestFullscreen().catch(e => console.log('Fullscreen failed:', e));
    } else {
        document.exitFullscreen().catch(e => console.log('Exit fullscreen failed:', e));
    }
    saveData();
}

function applyReducedMotion() {
    if (PlayerData.settings.reducedMotion) {
        document.body.style.setProperty('--animation-duration', '0s');
    } else {
        document.body.style.removeProperty('--animation-duration');
    }
}
function generatePuzzle(seed = null) {
    const config = DifficultyConfig[GameState.difficulty];
    GameState.gridSize = config.gridSize;
    GameState.gridWidth = config.gridSize;
    GameState.gridHeight = config.gridSize;
    
    const maxDimension = Math.max(config.gridSize, config.gridSize);
    
    // Override maxWordLength to use grid size
    config.maxWordLength = maxDimension;
    
    initializeGrid(config, seed);
    
    // Autocomplete if enabled for infinite/journey modes
    if (GameState.autocompleteEnabled && (GameState.gameMode === 'endless' || GameState.gameMode === 'journey')) {
        setTimeout(() => {
            GameState.words.forEach(word => {
                if (!GameState.foundWords.includes(word)) {
                    markWordAsFound(word);
                    GameState.foundWords.push(word);
                }
            });
            
            const baseScore = 10;
            const multiplier = 5;
            const wordScore = baseScore * multiplier;
            GameState.score = wordScore * GameState.words.length;
            
            completePuzzle();
        }, 100);
    }
}

function generateJourneyPuzzle(tierConfig) {
    GameState.gridSize = Math.max(tierConfig.gridWidth, tierConfig.gridHeight);
    GameState.gridWidth = tierConfig.gridWidth;
    GameState.gridHeight = tierConfig.gridHeight;
    
    const maxDimension = Math.max(tierConfig.gridWidth, tierConfig.gridHeight);
    
    const config = {
        gridSize: GameState.gridSize,
        wordCount: tierConfig.wordCount,
        directions: ['horizontal', 'vertical', 'diagonal'], // Use same 3 directions for 33% split
        minWordLength: 3,
        maxWordLength: maxDimension
    };
    
    initializeGrid(config, null);
}

function initializeGrid(config, seed) {
    const maxDimension = Math.max(GameState.gridWidth, GameState.gridHeight);
    
    GameState.grid = Array(GameState.gridHeight).fill(null).map(() => Array(GameState.gridWidth).fill(''));
    GameState.words = [];
    GameState.foundWords = [];
    GameState.wordPositions = [];
    GameState.selectedCells = [];
    GameState.score = 0;
    GameState.combo = 0;
    
    let randomFunc;
    if (seed) {
        const seedValue = seed.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        randomFunc = seededRandom(seedValue);
    } else {
        randomFunc = Math.random;
    }
    
    const categories = Object.keys(WordDictionary);
    const selectedWords = [];
    const placedWords = [];
    
    // Determine which categories to use
    let categoriesToUse = categories;
    // Journey mode always uses all categories
    if (GameState.gameMode !== 'journey' && GameState.selectedCategory && GameState.selectedCategory !== 'all') {
        categoriesToUse = [GameState.selectedCategory];
    }
    
    // Collect potential words first - ensure they fit in grid
    // Simplified approach for performance: collect all valid words
    const allValidWords = [];
    for (const category of categoriesToUse) {
        const validWordsInCategory = WordDictionary[category].filter(word => 
            word.length >= 3 && 
            word.length <= maxDimension
        );
        allValidWords.push(...validWordsInCategory);
    }
    
    // If selected category doesn't have enough words, use all categories
    if (allValidWords.length < config.wordCount * 2 && GameState.selectedCategory && GameState.selectedCategory !== 'all') {
        categoriesToUse = categories;
        allValidWords.length = 0;
        for (const category of categoriesToUse) {
            const validWordsInCategory = WordDictionary[category].filter(word => 
                word.length >= 3 && 
                word.length <= maxDimension
            );
            allValidWords.push(...validWordsInCategory);
        }
    }
    
    // Shuffle and select words
    allValidWords.sort(() => randomFunc() - 0.5);
    
    // Select unique words
    for (const word of allValidWords) {
        if (selectedWords.length >= config.wordCount * 5) break;
        if (!selectedWords.includes(word.toUpperCase())) {
            selectedWords.push(word.toUpperCase());
        }
    }
    
    // Shuffle and try to place words
    selectedWords.sort(() => randomFunc() - 0.5);
    
    // Determine direction distribution based on game mode
    let horizontalWords, verticalWords, diagonalWords;
    
    if (GameState.gameMode === 'journey') {
        // Use rotation cycle: 1=vertical, 2=horizontal, 3=diagonal, then repeat
        const directions = ['vertical', 'horizontal', 'diagonal'];
        horizontalWords = 0;
        verticalWords = 0;
        diagonalWords = 0;
        
        for (let i = 0; i < config.wordCount; i++) {
            const direction = directions[i % 3];
            if (direction === 'vertical') verticalWords++;
            else if (direction === 'horizontal') horizontalWords++;
            else diagonalWords++;
        }
    } else {
        // Split directions evenly: 1/3 horizontal, 1/3 vertical, 1/3 diagonal
        horizontalWords = Math.floor(config.wordCount / 3);
        verticalWords = Math.floor(config.wordCount / 3);
        diagonalWords = config.wordCount - horizontalWords - verticalWords;
    }
    
    let wordIndex = 0;
    let placedHorizontal = 0;
    let placedVertical = 0;
    let placedDiagonal = 0;
    
    // Place words with strict direction distribution - keep trying until all words are placed
    while (placedWords.length < config.wordCount && wordIndex < selectedWords.length * 3) {
        const word = selectedWords[wordIndex % selectedWords.length];
        
        // Determine which direction to try based on what still needs placement
        let directionPriority = [];
        if (placedHorizontal < horizontalWords) {
            directionPriority.push('horizontal');
        }
        if (placedVertical < verticalWords) {
            directionPriority.push('vertical');
        }
        if (placedDiagonal < diagonalWords) {
            directionPriority.push('diagonal');
        }
        
        // If we've met all quotas, allow any direction
        if (directionPriority.length === 0) {
            directionPriority = ['horizontal', 'vertical', 'diagonal'];
        }
        
        // Try to place the word with the prioritized direction
        if (placeWord(word, directionPriority, randomFunc)) {
            placedWords.push(word);
            
            // Update the appropriate counter based on actual direction used
            const lastPosition = GameState.wordPositions[GameState.wordPositions.length - 1];
            if (lastPosition.direction === 'horizontal') {
                placedHorizontal++;
            } else if (lastPosition.direction === 'vertical') {
                placedVertical++;
            } else {
                placedDiagonal++;
            }
        }
        
        wordIndex++;
    }
    
    // If we still don't have enough words, try with any direction
    while (placedWords.length < config.wordCount && wordIndex < selectedWords.length * 5) {
        const word = selectedWords[wordIndex % selectedWords.length];
        if (placeWord(word, ['horizontal', 'vertical', 'diagonal'], randomFunc)) {
            placedWords.push(word);
        }
        wordIndex++;
    }
    
    // Fallback: if we still don't have enough words, reduce the word count
    if (placedWords.length < config.wordCount) {
        console.warn(`Could only place ${placedWords.length} words out of ${config.wordCount} requested`);
        // Ensure at least 1 word is placed to prevent softlock
        if (placedWords.length === 0) {
            // Force place the first word horizontally at the top-left
            const word = selectedWords[0];
            const startPos = { row: 0, col: 0 };
            const endPos = { row: 0, col: Math.min(word.length - 1, GameState.gridWidth - 1) };
            GameState.wordPositions.push({
                word: word,
                start: startPos,
                end: endPos,
                direction: 'horizontal'
            });
            for (let i = 0; i < word.length && i < GameState.gridWidth; i++) {
                GameState.grid[0][i] = word[i];
            }
            placedWords.push(word);
            console.log(`Forced placement of word "${word}" to prevent softlock`);
        }
    }
    
    console.log(`Word placement: ${placedHorizontal} horizontal, ${placedVertical} vertical, ${placedDiagonal} diagonal out of ${placedWords.length} total`);
    console.log(`Words to find: ${placedWords.join(', ')}`);
    
    GameState.words = placedWords;
    
    // Fill remaining cells with random letters
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < GameState.gridHeight; i++) {
        for (let j = 0; j < GameState.gridWidth; j++) {
            if (GameState.grid[i][j] === '') {
                GameState.grid[i][j] = alphabet[Math.floor(randomFunc() * alphabet.length)];
            }
        }
    }
    
    renderGrid();
    renderWordList();
    updateHeaderDisplay();
}

function seededRandom(seed) {
    let value = seed;
    return function() {
        value = (value * 9301 + 49297) % 233280;
        return value / 233280;
    };
}

function placeWord(word, directions, randomFunc) {
    const gridWidth = GameState.gridWidth;
    const gridHeight = GameState.gridHeight;
    let placed = false;
    let attempts = 0;
    
    while (!placed && attempts < 200) {
        const direction = directions[Math.floor(randomFunc() * directions.length)];
        const startRow = Math.floor(randomFunc() * gridHeight);
        const startCol = Math.floor(randomFunc() * gridWidth);
        
        if (canPlaceWord(word, startRow, startCol, direction, gridWidth, gridHeight)) {
            const position = { word, startRow, startCol, direction, cells: [] };
            
            for (let i = 0; i < word.length; i++) {
                let row = startRow;
                let col = startCol;
                
                switch (direction) {
                    case 'horizontal':
                        col += i;
                        break;
                    case 'vertical':
                        row += i;
                        break;
                    case 'diagonal':
                        row += i;
                        col += i;
                        break;
                    case 'backwards':
                        col -= i;
                        break;
                    case 'diagonal-backwards':
                        row += i;
                        col -= i;
                        break;
                }
                
                GameState.grid[row][col] = word[i];
                position.cells.push({ row, col });
            }
            
            GameState.wordPositions.push(position);
            placed = true;
            return true;
        }
        
        attempts++;
    }
    
    return false;
}

function canPlaceWord(word, startRow, startCol, direction, gridWidth, gridHeight) {
    for (let i = 0; i < word.length; i++) {
        let row = startRow;
        let col = startCol;
        
        switch (direction) {
            case 'horizontal':
                col += i;
                break;
            case 'vertical':
                row += i;
                break;
            case 'diagonal':
                row += i;
                col += i;
                break;
            case 'backwards':
                col -= i;
                break;
            case 'diagonal-backwards':
                row += i;
                col -= i;
                break;
        }
        
        if (row < 0 || row >= gridHeight || col < 0 || col >= gridWidth) {
            return false;
        }
        
        const currentLetter = GameState.grid[row][col];
        if (currentLetter !== '' && currentLetter !== word[i]) {
            return false;
        }
    }
    
    return true;
}

// ==================== RENDERING ====================
function renderGrid() {
    const gridElement = document.getElementById('word-grid');
    gridElement.innerHTML = '';
    gridElement.style.gridTemplateColumns = `repeat(${GameState.gridWidth}, 40px)`;
    
    for (let i = 0; i < GameState.gridHeight; i++) {
        for (let j = 0; j < GameState.gridWidth; j++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.textContent = GameState.grid[i][j];
            cell.dataset.row = i;
            cell.dataset.col = j;
            
            cell.addEventListener('mousedown', handleCellMouseDown);
            cell.addEventListener('mouseenter', handleCellMouseEnter);
            cell.addEventListener('mouseup', handleCellMouseUp);
            cell.addEventListener('touchstart', handleTouchStart, { passive: false });
            cell.addEventListener('touchmove', handleTouchMove, { passive: false });
            cell.addEventListener('touchend', handleTouchEnd);
            
            gridElement.appendChild(cell);
        }
    }
}

function renderWordList() {
    const wordListElement = document.getElementById('word-list');
    wordListElement.innerHTML = '';
    
    // Add multi-column class if more than 10 words
    if (GameState.words.length >= 10) {
        wordListElement.classList.add('multi-column');
    } else {
        wordListElement.classList.remove('multi-column');
    }
    
    GameState.words.forEach(word => {
        const wordItem = document.createElement('div');
        wordItem.className = 'word-item';
        wordItem.textContent = word;
        wordItem.dataset.word = word;
        
        if (GameState.foundWords.includes(word)) {
            wordItem.classList.add('found');
        }
        
        wordListElement.appendChild(wordItem);
    });
}

function updateHeaderDisplay() {
    // Update mode label
    const modeLabel = document.getElementById('header-mode-label');
    const modeValue = document.getElementById('header-mode-value');
    const levelLabel = document.getElementById('header-level-label');
    const levelValue = document.getElementById('header-level-value');
    
    if (GameState.gameMode === 'journey') {
        modeLabel.textContent = 'Journey';
        modeValue.textContent = 'Mode';
        levelLabel.textContent = 'Level';
        levelValue.textContent = GameState.currentLevel;
    } else if (GameState.gameMode === 'endless') {
        modeLabel.textContent = 'Difficulty';
        modeValue.textContent = GameState.difficulty.charAt(0).toUpperCase() + GameState.difficulty.slice(1);
        levelLabel.textContent = 'Mode';
        levelValue.textContent = 'Endless';
    } else if (GameState.gameMode === 'daily') {
        modeLabel.textContent = 'Daily';
        modeValue.textContent = 'Puzzle';
        levelLabel.textContent = 'Streak';
        levelValue.textContent = `${PlayerData.dailyStreak} 🔥`;
    }
    
    // Update stats
    document.getElementById('header-timer').textContent = formatTime(GameState.timer);
    document.getElementById('header-words-found').textContent = GameState.foundWords.length;
    document.getElementById('header-total-words').textContent = GameState.words.length;
    document.getElementById('header-score').textContent = GameState.score;
    
    // Update hint counter
    updateHintDisplay();
}

function updateHintDisplay() {
    const hintButton = document.getElementById('hint-button');
    const hintCounter = document.getElementById('hint-counter');
    const hintRecharge = document.getElementById('hint-recharge');
    const hintRechargeDisplay = document.getElementById('hint-recharge-display');
    
    hintCounter.textContent = `${GameState.hintsRemaining}/${GameState.maxHints}`;
    
    if (hintRechargeDisplay) {
        hintRechargeDisplay.textContent = `Hints: ${GameState.hintsRemaining}/${GameState.maxHints}`;
    }
    
    // Disable hint button only when no hints remaining
    if (GameState.hintsRemaining <= 0) {
        hintButton.disabled = true;
    } else {
        hintButton.disabled = false;
    }
    
    // Show recharge timer when any hints are used (less than max)
    if (GameState.hintsRemaining < GameState.maxHints) {
        hintRecharge.style.display = 'block';
        
        if (GameState.hintRechargeStart) {
            const elapsed = Date.now() - GameState.hintRechargeStart;
            const remaining = GameState.hintRechargeTime - elapsed;
            const minutes = Math.ceil(remaining / 60000);
            hintRecharge.textContent = `${minutes}m`;
        }
    } else {
        hintRecharge.style.display = 'none';
    }
}

function updateHeaderForMenu() {
    document.getElementById('header-mode-label').textContent = '--';
    document.getElementById('header-mode-value').textContent = '--';
    document.getElementById('header-level-label').textContent = '--';
    document.getElementById('header-level-value').textContent = '--';
    document.getElementById('header-timer').textContent = '--:--';
    document.getElementById('header-words-found').textContent = '--';
    document.getElementById('header-total-words').textContent = '--';
    document.getElementById('header-score').textContent = '--';
}

function updateMainMenuDisplay() {
    document.getElementById('header-total-charms').textContent = PlayerData.totalScore;
    document.getElementById('header-total-gems').textContent = PlayerData.gems;
    updateHintDisplay();
}

function updateStatisticsDisplay() {
    document.getElementById('stat-longest-streak').textContent = PlayerData.longestStreak;
    document.getElementById('stat-total-score').textContent = PlayerData.netWorth;
    document.getElementById('stat-total-gems').textContent = PlayerData.totalGems;
    document.getElementById('stat-puzzles-completed').textContent = PlayerData.puzzlesCompleted;
    document.getElementById('stat-playtime').textContent = formatPlaytime(GameState.playtime);
    
    // Display highest league rank
    if (PlayerData.highestLeague && PlayerData.highestLeagueRank) {
        const config = LeagueConfig[PlayerData.highestLeague];
        document.getElementById('stat-highest-league').textContent = `${config.icon} #${PlayerData.highestLeagueRank}`;
    } else {
        document.getElementById('stat-highest-league').textContent = 'N/A';
    }
}

function formatPlaytime(seconds) {
    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${mins}m`;
    }
}

// ==================== SELECTION HANDLING ====================
function handleCellMouseDown(e) {
    if (GameState.isPaused) return;
    
    e.preventDefault();
    GameState.isSelecting = true;
    GameState.selectionStart = {
        row: parseInt(e.target.dataset.row),
        col: parseInt(e.target.dataset.col)
    };
    GameState.selectedCells = [GameState.selectionStart];
    updateSelectionDisplay();
}

function handleCellMouseEnter(e) {
    if (!GameState.isSelecting || GameState.isPaused) return;
    
    const currentCell = {
        row: parseInt(e.target.dataset.row),
        col: parseInt(e.target.dataset.col)
    };
    
    GameState.selectedCells = getLineCells(GameState.selectionStart, currentCell);
    updateSelectionDisplay();
}

function handleCellMouseUp(e) {
    if (!GameState.isSelecting || GameState.isPaused) return;
    
    GameState.isSelecting = false;
    checkSelection();
    clearSelection();
}

let touchStartCell = null;

function handleTouchStart(e) {
    if (GameState.isPaused) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    const cell = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (cell && cell.classList.contains('grid-cell')) {
        touchStartCell = {
            row: parseInt(cell.dataset.row),
            col: parseInt(cell.dataset.col)
        };
        GameState.isSelecting = true;
        GameState.selectionStart = touchStartCell;
        GameState.selectedCells = [touchStartCell];
        updateSelectionDisplay();
    }
}

function handleTouchMove(e) {
    if (!GameState.isSelecting || GameState.isPaused) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    const cell = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (cell && cell.classList.contains('grid-cell')) {
        const currentCell = {
            row: parseInt(cell.dataset.row),
            col: parseInt(cell.dataset.col)
        };
        
        GameState.selectedCells = getLineCells(GameState.selectionStart, currentCell);
        updateSelectionDisplay();
    }
}

function handleTouchEnd(e) {
    if (!GameState.isSelecting || GameState.isPaused) return;
    
    GameState.isSelecting = false;
    checkSelection();
    clearSelection();
    touchStartCell = null;
}

function getLineCells(start, end) {
    const cells = [];
    const rowDiff = end.row - start.row;
    const colDiff = end.col - start.col;
    
    if (rowDiff === 0 || colDiff === 0 || Math.abs(rowDiff) === Math.abs(colDiff)) {
        const steps = Math.max(Math.abs(rowDiff), Math.abs(colDiff));
        const rowStep = rowDiff === 0 ? 0 : rowDiff / Math.abs(rowDiff);
        const colStep = colDiff === 0 ? 0 : colDiff / Math.abs(colDiff);
        
        for (let i = 0; i <= steps; i++) {
            cells.push({
                row: start.row + i * rowStep,
                col: start.col + i * colStep
            });
        }
    }
    
    return cells;
}

function updateSelectionDisplay() {
    document.querySelectorAll('.grid-cell').forEach(cell => {
        cell.classList.remove('selected');
    });
    
    GameState.selectedCells.forEach(cell => {
        const cellElement = document.querySelector(`.grid-cell[data-row="${cell.row}"][data-col="${cell.col}"]`);
        if (cellElement) {
            cellElement.classList.add('selected');
        }
    });
}

function clearSelection() {
    document.querySelectorAll('.grid-cell').forEach(cell => {
        cell.classList.remove('selected');
    });
    GameState.selectedCells = [];
}

// ==================== WORD VALIDATION ====================
function checkSelection() {
    if (GameState.selectedCells.length < 2) return;
    
    const selectedWord = GameState.selectedCells.map(cell => 
        GameState.grid[cell.row][cell.col]
    ).join('');
    
    const reversedWord = selectedWord.split('').reverse().join('');
    
    let foundWord = null;
    if (GameState.words.includes(selectedWord) && !GameState.foundWords.includes(selectedWord)) {
        foundWord = selectedWord;
    } else if (GameState.words.includes(reversedWord) && !GameState.foundWords.includes(reversedWord)) {
        foundWord = reversedWord;
    }
    
    if (foundWord) {
        GameState.foundWords.push(foundWord);
        markWordAsFound(foundWord);
        AudioSystem.playCorrect();
        
        GameState.combo++;
        
        // Score system: +10 base per word, multiplied by current multiplier
        const baseScore = 10;
        const multiplier = Math.min(GameState.combo, 5);
        const wordScore = baseScore * multiplier;
        GameState.score += wordScore;
        
        if (GameState.combo > 1) {
            showCombo(GameState.combo);
        }
        
        // Reset inactivity timer - 10 seconds to make next move
        if (GameState.inactivityTimer) {
            clearTimeout(GameState.inactivityTimer);
        }
        GameState.inactivityTimer = setTimeout(() => {
            GameState.combo = 0;
            updateHeaderDisplay();
        }, 10000); // 10 seconds
        
        updateHeaderDisplay();
        
        console.log(`Found words: ${GameState.foundWords.length}/${GameState.words.length}`);
        if (GameState.foundWords.length === GameState.words.length) {
            console.log('All words found, completing puzzle');
            setTimeout(completePuzzle, 500);
        }
    } else {
        AudioSystem.playIncorrect();
        // Reset multiplier on mistake
        GameState.combo = 0;
        updateHeaderDisplay();
    }
    
    // Autocomplete if enabled
    if (GameState.autocompleteEnabled && GameState.words.length > 0) {
        const unfoundWords = GameState.words.filter(word => !GameState.foundWords.includes(word));
        if (unfoundWords.length > 0) {
            const wordToFind = unfoundWords[0];
            // Find the word position
            const wordPos = GameState.wordPositions.find(wp => wp.word === wordToFind);
            if (wordPos) {
                // Mark all cells in the word as found
                markWordAsFound(wordToFind);
                GameState.foundWords.push(wordToFind);
                AudioSystem.playCorrect();
                GameState.combo++;
                const baseScore = 10;
                const multiplier = Math.min(GameState.combo, 5);
                const wordScore = baseScore * multiplier;
                GameState.score += wordScore;
                updateHeaderDisplay();
                
                if (GameState.foundWords.length === GameState.words.length) {
                    setTimeout(completePuzzle, 500);
                }
            }
        }
    }
}

function markWordAsFound(word) {
    const wordPosition = GameState.wordPositions.find(wp => wp.word === word);
    
    if (wordPosition) {
        wordPosition.cells.forEach(cell => {
            const cellElement = document.querySelector(`.grid-cell[data-row="${cell.row}"][data-col="${cell.col}"]`);
            if (cellElement) {
                cellElement.classList.add('found');
            }
        });
    }
    
    const wordItem = document.querySelector(`.word-item[data-word="${word}"]`);
    if (wordItem) {
        wordItem.classList.add('found');
    }
}

function showCombo(combo) {
    const comboDisplay = document.getElementById('combo-display');
    
    // Determine supportive text based on multiplier
    const multiplier = Math.min(combo, 5);
    const messages = {
        1: '',
        2: 'Good!',
        3: 'Great!',
        4: 'Amazing!',
        5: 'FANTASTIC!'
    };
    
    const message = messages[multiplier];
    if (message) {
        comboDisplay.textContent = message;
        comboDisplay.classList.add('show');
        
        setTimeout(() => {
            comboDisplay.classList.remove('show');
        }, 1000);
    }
}

// ==================== DEVTOOLS ====================
function showDevtools() {
    showScreen('devtools-screen');
    updateDevtoolsDisplay();
}

function closeDevtools() {
    showScreen('main-menu');
}

function updateDevtoolsDisplay() {
    const autocompleteStatus = document.getElementById('autocomplete-status');
    if (autocompleteStatus) {
        autocompleteStatus.textContent = GameState.autocompleteEnabled ? 'ON' : 'OFF';
    }
}

function devtoolsAddGems() {
    PlayerData.gems += 100;
    PlayerData.totalGems += 100;
    saveData();
    updateMainMenuDisplay();
    alert('Added 100 gems');
}

function devtoolsAddCharms() {
    PlayerData.totalScore += 10000;
    PlayerData.score += 10000;
    PlayerData.netWorth += 10000;
    addCharmsToLeague(10000);
    saveData();
    updateMainMenuDisplay();
    alert('Added 10000 charms');
}

function devtoolsEndLeague() {
    resetLeagueWeek();
    alert('League week ended');
}

function devtoolsToggleAutocomplete() {
    GameState.autocompleteEnabled = !GameState.autocompleteEnabled;
    updateDevtoolsDisplay();
    alert(`Autocomplete is now ${GameState.autocompleteEnabled ? 'ON' : 'OFF'}`);
}

function devtoolsCompleteDaily() {
    // Start daily puzzle first
    startDailyPuzzle();
    
    // Complete all words
    GameState.words.forEach(word => {
        if (!GameState.foundWords.includes(word)) {
            markWordAsFound(word);
            GameState.foundWords.push(word);
        }
    });
    
    // Calculate score
    const baseScore = 10;
    const multiplier = 5;
    const wordScore = baseScore * multiplier;
    GameState.score = wordScore * GameState.words.length;
    
    // Complete the puzzle
    completePuzzle();
    
    alert('Daily completed');
}

function devtoolsEndStreak() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    PlayerData.lastDailyDate = yesterday.toDateString();
    saveData();
    alert('Streak ended (set to 2 days ago)');
}

function devtoolsAddStreak() {
    PlayerData.dailyStreak++;
    if (PlayerData.dailyStreak > PlayerData.longestStreak) {
        PlayerData.longestStreak = PlayerData.dailyStreak;
    }
    saveData();
    alert('Added +1 to streak');
}

// ==================== GAME COMPLETION ====================
function completePuzzle() {
    console.log('completePuzzle called');
    stopTimer();
    
    // Reset chest reward
    GameState.chestReward = null;
    
    // Clear inactivity timer
    if (GameState.inactivityTimer) {
        clearTimeout(GameState.inactivityTimer);
        GameState.inactivityTimer = null;
    }
    
    // Use the actual score accumulated during gameplay
    const totalScore = GameState.score;
    
    PlayerData.score += totalScore;
    PlayerData.totalScore += totalScore;
    PlayerData.netWorth += totalScore;
    PlayerData.puzzlesCompleted++;
    
    // Add charms to league
    addCharmsToLeague(totalScore);
    
    // Store totalScore for display
    GameState.finalScore = totalScore;
    
    // Only update streak for daily puzzles
    if (GameState.gameMode === 'daily') {
        PlayerData.dailyCompletedToday = true;
        PlayerData.totalDailyCompleted++;
        const today = new Date().toDateString();
        
        // Increment streak on completion
        if (PlayerData.lastDailyDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (PlayerData.lastDailyDate === yesterday.toDateString()) {
                PlayerData.dailyStreak++;
            } else {
                // First daily or missed days, save previous streak and start at 1
                if (PlayerData.dailyStreak > 0) {
                    PlayerData.previousStreak = PlayerData.dailyStreak;
                }
                PlayerData.dailyStreak = 1;
            }
            
            PlayerData.lastDailyDate = today;
        }
        
        // Update longest streak (daily only)
        if (PlayerData.dailyStreak > PlayerData.longestStreak) {
            PlayerData.longestStreak = PlayerData.dailyStreak;
        }
    }
    // Only update journey progress for journey mode
    if (GameState.gameMode === 'journey') {
        if (!PlayerData.completedLevels.includes(GameState.currentLevel)) {
            PlayerData.completedLevels.push(GameState.currentLevel);
        }
        if (GameState.currentLevel >= PlayerData.journeyLevel) {
            PlayerData.journeyLevel = Math.min(1000, GameState.currentLevel + 1);
        }
        
        // Award chest every 10 levels
        if (GameState.currentLevel % 10 === 0 && !PlayerData.completedLevels.includes(`chest_${GameState.currentLevel}`)) {
            const gemsEarned = Math.floor(Math.random() * 2) + 1; // 1-2 gems
            PlayerData.gems += gemsEarned;
            PlayerData.totalGems += gemsEarned;
            PlayerData.completedLevels.push(`chest_${GameState.currentLevel}`);
            GameState.chestReward = gemsEarned;
        }
    }
    
    saveData();
    
    document.getElementById('complete-score').textContent = `+${GameState.finalScore}`;
    document.getElementById('complete-time').textContent = formatTime(GameState.timer);
    document.getElementById('complete-combo').textContent = `x${GameState.combo}`;
    
    // Show chest reward if earned
    if (GameState.chestReward) {
        document.getElementById('chest-reward-row').style.display = 'flex';
        document.getElementById('chest-reward').textContent = `+${GameState.chestReward} Gems`;
    } else {
        document.getElementById('chest-reward-row').style.display = 'none';
    }
    
    showScreen('complete-screen');
}

function nextLevel() {
    if (GameState.gameMode === 'journey') {
        GameState.currentLevel = PlayerData.journeyLevel;
        startJourneyLevel(GameState.currentLevel);
    } else {
        generatePuzzle();
        showScreen('game-screen');
        startTimer();
        updateHeaderDisplay();
    }
}

function restartPuzzle() {
    if (GameState.gameMode === 'journey') {
        startJourneyLevel(GameState.currentLevel);
    } else {
        generatePuzzle();
        showScreen('game-screen');
        startTimer();
        updateHeaderDisplay();
    }
}

// ==================== TIMER ====================
function startTimer() {
    GameState.timer = 0;
    GameState.isPaused = false;
    
    GameState.timerInterval = setInterval(() => {
        if (!GameState.isPaused) {
            GameState.timer++;
            document.getElementById('header-timer').textContent = formatTime(GameState.timer);
            updateDailyCountdown();
        }
    }, 1000);
}

function stopTimer() {
    if (GameState.timerInterval) {
        clearInterval(GameState.timerInterval);
        GameState.timerInterval = null;
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ==================== PAUSE ====================
function pauseGame() {
    GameState.isPaused = true;
    
    // Clear inactivity timer
    if (GameState.inactivityTimer) {
        clearTimeout(GameState.inactivityTimer);
        GameState.inactivityTimer = null;
    }
    
    showScreen('pause-screen');
}

function resumeGame() {
    GameState.isPaused = false;
    showScreen('game-screen');
    updateHeaderDisplay(); // Restore header stats
}

// ==================== BONUS FEATURES ====================
function useHint() {
    console.log('useHint called, hintsRemaining:', GameState.hintsRemaining);
    if (GameState.hintsRemaining <= 0) return;
    
    const unfoundWord = GameState.words.find(word => !GameState.foundWords.includes(word));
    if (!unfoundWord) return;
    
    GameState.hintsRemaining--;
    PlayerData.hintsRemaining = GameState.hintsRemaining;
    PlayerData.hintsUsed++;
    
    console.log('After using hint, hintsRemaining:', GameState.hintsRemaining);
    
    // Start recharge timer immediately after using a hint
    if (GameState.hintsRemaining < GameState.maxHints && !GameState.hintRechargeStart) {
        GameState.hintRechargeStart = Date.now();
        PlayerData.hintRechargeStart = GameState.hintRechargeStart;
    }
    
    const wordPosition = GameState.wordPositions.find(wp => wp.word === unfoundWord);
    if (wordPosition && wordPosition.cells.length > 0) {
        const firstCell = wordPosition.cells[0];
        const cellElement = document.querySelector(`.grid-cell[data-row="${firstCell.row}"][data-col="${firstCell.col}"]`);
        if (cellElement) {
            cellElement.classList.add('hint');
            setTimeout(() => {
                cellElement.classList.remove('hint');
            }, 3000);
        }
    }
    
    const wordItem = document.querySelector(`.word-item[data-word="${unfoundWord}"]`);
    if (wordItem) {
        wordItem.classList.add('hinted');
        setTimeout(() => {
            wordItem.classList.remove('hinted');
        }, 3000);
    }
    
    updateHintDisplay();
    saveData();
    console.log('Saved data after using hint');
    AudioSystem.playUI();
}

function toggleFocusMode() {
    GameState.focusMode = !GameState.focusMode;
    const focusOverlay = document.getElementById('focus-overlay');
    
    if (GameState.focusMode) {
        focusOverlay.classList.remove('hidden');
        document.getElementById('game-screen').style.zIndex = '201';
    } else {
        focusOverlay.classList.add('hidden');
        document.getElementById('game-screen').style.zIndex = '1';
    }
    
    AudioSystem.playUI();
}

// ==================== HINT RECHARGE ====================
function startHintRecharge() {
    setInterval(() => {
        if (GameState.hintsRemaining < GameState.maxHints) {
            if (!GameState.hintRechargeStart) {
                GameState.hintRechargeStart = Date.now();
            }
            
            const elapsed = Date.now() - GameState.hintRechargeStart;
            if (elapsed >= GameState.hintRechargeTime) {
                GameState.hintsRemaining++;
                GameState.hintRechargeStart = Date.now();
                updateHintDisplay();
                saveData();
            }
            
            updateHintDisplay();
        }
    }, 1000);
}

// ==================== PLAYTIME TRACKING ====================
function startPlaytimeTracking() {
    GameState.playtimeInterval = setInterval(() => {
        if (GameState.isTabActive) {
            GameState.playtime++;
            PlayerData.playtime = GameState.playtime;
            // Update statistics display live if stats screen is visible
            if (GameState.currentScreen === 'statistics-screen') {
                document.getElementById('stat-playtime').textContent = formatPlaytime(GameState.playtime);
            }
        }
    }, 1000);
    
    document.addEventListener('visibilitychange', () => {
        GameState.isTabActive = !document.hidden;
    });
    
    window.addEventListener('beforeunload', () => {
        saveData();
    });
}

// ==================== DAILY PUZZLE COUNTDOWN ====================
function startDailyCountdown() {
    setInterval(() => {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const diff = tomorrow - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        const countdownElement = document.getElementById('daily-countdown');
        const buttonTimerElement = document.getElementById('daily-button-timer');
        const timerString = `${hours}h ${minutes}m ${seconds}s`;
        
        if (countdownElement) {
            countdownElement.textContent = timerString;
        }
        
        if (buttonTimerElement) {
            buttonTimerElement.textContent = timerString;
        }
        
        const doorElement = document.getElementById('daily-door');
        const dailyButton = document.querySelector('.menu-btn.daily');
        const streakDisplay = document.getElementById('daily-streak');
        const completedDisplay = document.getElementById('daily-completed-display');
        
        if (doorElement) {
            if (PlayerData.dailyCompletedToday) {
                doorElement.classList.add('locked');
            } else {
                doorElement.classList.remove('locked');
            }
        }
        
        if (dailyButton) {
            // Don't disable the button - allow viewing completed puzzle
            dailyButton.disabled = false;
            dailyButton.style.opacity = '1';
        }
        
        if (streakDisplay) {
            streakDisplay.textContent = `${PlayerData.dailyStreak} 🔥`;
        }
        
        if (completedDisplay) {
            completedDisplay.textContent = PlayerData.totalDailyCompleted;
        }
        
        // Reset daily completion at midnight
        const today = new Date().toDateString();
        if (PlayerData.lastDailyDate !== today && PlayerData.lastDailyDate !== null) {
            // It's a new day, check if streak should reset
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (PlayerData.lastDailyDate !== yesterday.toDateString()) {
                // Missed a day, reset streak
                PlayerData.dailyStreak = 0;
            }
            
            PlayerData.dailyCompletedToday = false;
            saveData();
        }
    }, 1000);
}

// ==================== ATMOSPHERIC EFFECTS ====================
function createRainDrop() {
    const rainContainer = document.querySelector('.rain-container');
    if (!rainContainer) return;
    
    const drop = document.createElement('div');
    drop.style.position = 'absolute';
    drop.style.left = Math.random() * 100 + '%';
    drop.style.top = '-10px';
    drop.style.width = '2px';
    drop.style.height = '20px';
    drop.style.background = 'rgba(176, 190, 197, 0.5)';
    drop.style.animation = 'rain-fall 1s linear forwards';
    
    rainContainer.appendChild(drop);
    
    setTimeout(() => {
        drop.remove();
    }, 1000);
}

const rainStyle = document.createElement('style');
rainStyle.textContent = `
    @keyframes rain-fall {
        to {
            transform: translateY(100vh);
        }
    }
`;
document.head.appendChild(rainStyle);

setInterval(() => {
    if (!PlayerData.settings.reducedMotion) {
        for (let i = 0; i < 3; i++) {
            setTimeout(createRainDrop, i * 100);
        }
    }
}, 500);

// ==================== INITIALIZATION ====================
function init() {
    loadData();
    
    console.log('After loadData - PlayerData.hintsRemaining:', PlayerData.hintsRemaining);
    console.log('After loadData - GameState.hintsRemaining:', GameState.hintsRemaining);
    
    // Sync hints from PlayerData after loading
    GameState.hintsRemaining = PlayerData.hintsRemaining;
    GameState.hintRechargeStart = PlayerData.hintRechargeStart;
    GameState.playtime = PlayerData.playtime;
    
    console.log('After sync - GameState.hintsRemaining:', GameState.hintsRemaining);
    
    AudioSystem.init();
    AudioSystem.loadThemeAudio();
    
    // Apply current theme CSS class
    if (PlayerData.currentTheme && PlayerData.currentTheme !== 'zen') {
        document.body.className = 'theme-' + PlayerData.currentTheme;
    }
    
    updateMainMenuDisplay();
    applyReducedMotion();
    startHintRecharge();
    startPlaytimeTracking();
    startDailyCountdown();
    showDailyCountdown();
    startLeagueTimer();
    updateHeaderForMenu();
    
    // Show devtools button if enabled
    if (ENABLE_DEVTOOLS) {
        document.getElementById('devtools-btn').style.display = 'inline-block';
    }
    
    document.addEventListener('mouseup', () => {
        if (GameState.isSelecting) {
            GameState.isSelecting = false;
            checkSelection();
            clearSelection();
        }
    });
    
    document.addEventListener('fullscreenchange', () => {
        const fullscreenToggle = document.getElementById('fullscreen-toggle');
        if (fullscreenToggle) {
            fullscreenToggle.checked = !!document.fullscreenElement;
        }
    });
    
    console.log('ZenWords initialized successfully!');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
