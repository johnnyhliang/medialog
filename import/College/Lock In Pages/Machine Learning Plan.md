# Comprehensive ML Foundation Learning Roadmap

_From Mathematical Foundations to Production-Ready Deep Learning_

## Learning Philosophy

**Three-Pronged Approach:**

1. **Breadth First**: Survey all major ML topics to understand the landscape
2. **Depth in Fundamentals**: Build strong mathematical intuition
3. **Hands-On Implementation**: Code everything from scratch, then use libraries

**Time Commitment**: 4-6 months of focused study (15-20 hours/week)

---

## Phase 1: Broad ML Survey (4-6 weeks)

_Goal: Understand the full ML landscape and identify where RL/LLMs fit_

### Primary Resource: Andrew Ng's Original Machine Learning (Stanford CS229)

**YouTube Playlist**: [CS229: Machine Learning (Autumn 2018)](https://www.youtube.com/playlist?list=PLoROMvodv4rMiGQp3WXShtMGgzqpfVfbU)

**What to Cover:**

- Supervised Learning (Linear Regression, Logistic Regression, SVMs)
- Unsupervised Learning (K-means, PCA, Gaussian Mixture Models)
- Generative vs Discriminative Models
- Bias-Variance Tradeoff
- Regularization (L1, L2)
- Neural Networks Basics
- Advice for Applying ML (debugging strategies, error analysis)

**Why This First:**

- Covers classical ML comprehensively
- Strong mathematical treatment without being overwhelming
- Builds vocabulary for understanding modern papers
- Excellent practical advice on model debugging

**Weekly Breakdown:**

- **Week 1-2**: Supervised learning foundations (lectures 1-8)
- **Week 3**: Unsupervised learning & dimensionality reduction (lectures 9-13)
- **Week 4**: Neural networks intro, practical ML advice (lectures 14-20)

**Assignments:**

- Complete problem sets (available on CS229 website)
- Implement algorithms in Python/NumPy
- Don't use sklearn yet - code from scratch

### Supplementary: Berkeley CS 189/289A

**Course Page**: [Berkeley CS 189 Introduction to Machine Learning](https://people.eecs.berkeley.edu/~jrs/189/)

**Use For:**

- More rigorous mathematical proofs
- Excellent lecture notes (better written than videos sometimes)
- Problem sets with solutions for self-study
- Topics: kernel methods, decision trees, ensemble methods

**Recommended Lectures:**

- Decision Trees and Random Forests
- Boosting and Ensemble Methods
- Kernel Methods and SVMs (more rigorous than CS229)

---

## Phase 2: Deep Learning Fundamentals (6-8 weeks)

_Goal: Master neural networks from first principles_

### Primary Resource: Andrej Karpathy's Neural Networks: Zero to Hero

**YouTube Playlist**: [Neural Networks: Zero to Hero](https://www.youtube.com/playlist?list=PLAqhIrjkxbuWI23v9cThsA9GvCAUhRvKZ)

**Video-by-Video Plan:**

**Week 1: The spelled-out intro to neural networks and backpropagation**

- Micrograd: Build autograd engine from scratch
- Understand backpropagation at a fundamental level
- Implement: Complete micrograd library
- **Key Insight**: Backprop is just recursive chain rule

**Week 2: Building makemore Part 1-2**

- Character-level language modeling
- Bigram models, MLP language models
- Understanding embeddings and loss functions
- Implement: Character-level name generator

**Week 3-4: Building makemore Part 3-5**

- Batch normalization (and why it works)
- Implementing modern architectures (WaveNet-style)
- PyTorch-like nn module from scratch
- **Critical**: Deep dive into initialization, activation functions

**Week 5-6: Let's build GPT from scratch**

- Transformer architecture implementation
- Self-attention mechanism (THE most important concept)
- Positional encodings
- Layer normalization
- Implement: GPT from scratch in PyTorch
- **This is the foundation for understanding LLMs**

**Week 7-8: Building a Tokenizer and Advanced Topics**

- Byte-pair encoding (BPE)
- Understanding tokenization's role in LLMs
- Training loops, optimization strategies

**Assignments:**

- Complete all coding exercises
- Extend implementations with your own experiments
- Train models on different datasets
- Document everything in GitHub repo

### Supplementary: Neural Networks from Scratch (Book)

**Resource**: "Neural Networks from Scratch in Python" by Harrison Kinsley & Daniel Kukieła

**Use For:**

- Alternative explanations of backpropagation
- Different implementation perspectives
- CNN architectures from scratch
- Good for solidifying understanding

**Key Chapters:**

1. Dense Layers and Activation Functions
2. Loss and Optimization
3. Backpropagation Deep Dive
4. Convolutional Neural Networks

---

## Phase 3: Mathematical Deep Dive (4-6 weeks)

_Goal: Build rigorous mathematical intuition for modern ML_

### Primary Resource: Mathematics for Machine Learning (MML Book)

**Free Online**: [mml-book.github.io](https://mml-book.github.io/)

**Focused Study Plan:**

**Week 1-2: Linear Algebra (Chapter 2)**

- Vector spaces, linear mappings
- Matrix decompositions (SVD, eigendecomposition)
- **Why it matters**: Understanding attention, embeddings, PCA

**Week 2-3: Analytic Geometry (Chapter 3)**

- Norms, inner products, orthogonality
- **Why it matters**: Distance metrics, similarity measures in embeddings

**Week 3-4: Matrix Decompositions (Chapter 4)**

- Determinants, eigenvalues, eigenvectors
- PCA from scratch
- **Why it matters**: Dimensionality reduction, understanding model representations

**Week 4-5: Probability Theory (Chapter 6)**

- Probability distributions
- Bayes' theorem applications
- Expectations, variance
- **Why it matters**: Probabilistic models, uncertainty in ML

**Week 5-6: Optimization (Chapter 7)**

- Gradient descent variants
- Convex optimization
- Lagrange multipliers
- **Why it matters**: Training algorithms, understanding convergence

### Supplementary: The Matrix Calculus You Need for Deep Learning

**Paper**: [The Matrix Calculus You Need for Deep Learning](https://explained.ai/matrix-calculus/)

**Focus:**

- Vector and matrix derivatives
- Jacobian and Hessian matrices
- Chain rule in vector form
- **Critical for**: Understanding backpropagation mathematically

### Supplementary: Probability and Statistics Review

**Resource**: Harvard Stat 110 (YouTube) - Selected lectures

**Key Topics:**

- Conditional probability and Bayes' rule
- Expectation and variance
- Common distributions (Gaussian, Bernoulli, Categorical)
- Maximum likelihood estimation

---

## Phase 4: Modern Deep Learning (6-8 weeks)

_Goal: Understand state-of-the-art architectures and training techniques_

### Primary Resource: Stanford CS231n (CNNs for Visual Recognition)

**YouTube**: [CS231n Spring 2017](https://www.youtube.com/playlist?list=PLC1qU-LWwrF64f4QKQT-Vg5Wr4qEE1Zxk)

**Why CNNs Matter for NLP/LLMs:**

- Convolutional thinking appears in modern architectures
- Understanding inductive biases
- Optimization techniques transfer directly

**Key Lectures:**

- Lecture 4-5: Backpropagation and Neural Networks
- Lecture 6-7: Training Neural Networks (Parts I & II)
- Lecture 10: Recurrent Neural Networks (RNN background for transformers)
- Lecture 11: Detection and Segmentation (architecture design principles)

### Primary Resource: Stanford CS224n (NLP with Deep Learning)

**YouTube**: [CS224n Winter 2021](https://www.youtube.com/playlist?list=PLoROMvodv4rOSH4v6133s9LFPRHjEmbmJ)

**Essential for LLM/RL Work:**

**Week 1-2: Foundations**

- Lecture 1-3: Word vectors, embeddings, neural networks for NLP
- Understand: Word2Vec, GloVe
- Implement: Skip-gram model

**Week 3-4: Sequence Models**

- Lecture 5-6: RNNs, LSTMs, GRUs
- Lecture 7-8: Vanishing gradients, fancy RNNs
- Understand: Why transformers replaced RNNs

**Week 5-6: Transformers & Attention** ⭐ MOST CRITICAL

- Lecture 9-10: Self-attention and transformers
- Lecture 11: Transformers and pretraining
- Deep dive: Multi-head attention mechanism
- Implement: Transformer from scratch (if not done in Karpathy series)

**Week 7-8: Modern LLMs**

- Lecture 12-13: Question answering, NLG
- Lecture 18: Future of NLP (covers scaling, emergent abilities)

**Assignments:**

- Complete all 5 assignments
- Assignment 5 (final project) - do something with RL+NLP

### Supplementary: The Annotated Transformer

**Resource**: [The Annotated Transformer](http://nlp.seas.harvard.edu/annotated-transformer/)

**Use For:**

- Line-by-line implementation guide
- Understanding every component
- Reference when implementing your own transformers

---

## Phase 5: Reinforcement Learning (6-8 weeks)

_Goal: Master RL fundamentals to apply to LLMs_

### Primary Resource: Berkeley CS 285 Deep Reinforcement Learning

**YouTube**: [CS 285 Fall 2023](https://www.youtube.com/playlist?list=PL_iWQOsE6TfVYGEGiAOMaOzzv41Jfm_Ps)

**Comprehensive Coverage:**

**Week 1-2: RL Foundations**

- Lecture 1-4: Imitation learning, MDPs, policy gradients
- Understand: Value functions, Q-learning, policy gradients
- Implement: Simple policy gradient algorithm

**Week 3-4: Deep RL Algorithms**

- Lecture 5-8: Actor-critic, value functions, Q-learning with NNs
- Lecture 9-10: Advanced policy gradients (TRPO, PPO)
- **PPO is critical for RLHF**
- Implement: PPO from scratch

**Week 5-6: Model-Based RL & Planning**

- Lecture 11-14: Model-based RL, policy learning with models
- Understand: Planning vs learning tradeoffs

**Week 7-8: Advanced Topics**

- Lecture 15-17: Exploration, offline RL, inverse RL
- **Inverse RL connects to reward learning in RLHF**

### Supplementary: Sutton & Barto - Reinforcement Learning: An Introduction

**Free Online**: [RL Book - 2nd Edition](http://incompleteideas.net/book/the-book-2nd.html)

**Use For:**

- Theoretical foundations
- Mathematical rigor
- Classic algorithms (Q-learning, SARSA, TD learning)

**Key Chapters:**

- Chapter 3-4: MDPs, Dynamic Programming
- Chapter 6: Temporal-Difference Learning
- Chapter 13: Policy Gradient Methods

### Supplementary: Spinning Up in Deep RL (OpenAI)

**Resource**: [spinningup.openai.com](https://spinningup.openai.com/)

**Use For:**

- Clean implementations of key algorithms
- Practical tips for training RL agents
- Understanding algorithm comparisons

**Implement:**

- VPG (Vanilla Policy Gradient)
- PPO (Proximal Policy Optimization)
- SAC (Soft Actor-Critic)

---

## Phase 6: LLMs & RLHF (4-6 weeks)

_Goal: Understand modern LLM training and alignment_

### Primary Resource: Recent Papers & Tutorials

**Week 1-2: LLM Foundations**

- Read: "Attention Is All You Need" (Vaswani et al.)
- Read: "GPT-3" (Brown et al.) - scaling laws
- Read: "PaLM" (Chowdhery et al.) - modern architecture choices
- Tutorial: Hugging Face Transformers documentation

**Week 3-4: RLHF Deep Dive** ⭐ MOST RELEVANT FOR YOUR GOALS

- Read: "InstructGPT" (Ouyang et al.) - foundational RLHF paper
- Read: "Training language models to follow instructions with human feedback"
- Read: "Constitutional AI" (Anthropic) - RLAIF
- Implement: Simple RLHF pipeline with smaller models

**Week 5-6: Modern Techniques**

- Read: "Direct Preference Optimization" (DPO)
- Read: "Proximal Policy Optimization Algorithms" (Schulman et al.)
- Study: TRL library (Transformer Reinforcement Learning)
- Project: Fine-tune small LLM with DPO

### Key Papers to Read & Implement:

**Foundation (Must Read):**

1. Attention Is All You Need (2017)
2. BERT (2018) - bidirectional encoders
3. GPT-2 (2019) - scaling decoder-only models
4. GPT-3 (2020) - few-shot learning

**RLHF & Alignment (Must Read):**

1. InstructGPT (2022)
2. Constitutional AI (2022)
3. Direct Preference Optimization (2023)
4. RLAIF: Scaling Reinforcement Learning from Human Feedback (2023)

**Implementation Resources:**

- Hugging Face TRL (Transformer Reinforcement Learning)
- DeepSpeed-Chat (RLHF training pipeline)
- AlpacaFarm (simulated RLHF)

---

## Integrated Project Timeline

### Month 1-2: Classical ML + First Neural Network

**Project**: Implement linear regression, logistic regression, basic NN from scratch **Output**: Blog post explaining backpropagation with visualizations

### Month 3-4: Deep Learning Fundamentals

**Project**: Character-level language model (from Karpathy series) **Output**: GitHub repo with clean implementations

### Month 5: Transformer Implementation

**Project**: Build GPT-2 from scratch, train on small corpus **Output**: Working model + detailed documentation

### Month 6: Vision & Advanced Architectures

**Project**: Implement CNN for image classification **Output**: Comparative study of different architectures

### Month 7-8: Deep RL

**Project**: Train PPO agent on gym environment **Output**: Analysis of training dynamics, hyperparameter sensitivity

### Month 9: RLHF Pipeline

**Project**: Fine-tune small LLM (GPT-2 or LLaMA 7B) using DPO **Output**: Workshop paper quality experiment + writeup

---

## Essential Tools & Setup

### Development Environment

```bash
# Core libraries
pip install torch torchvision torchaudio
pip install transformers datasets
pip install gym stable-baselines3
pip install wandb tensorboard
pip install jupyter numpy pandas matplotlib seaborn

# For RLHF
pip install trl peft accelerate
pip install bitsandbytes  # for efficient training
```

### Computational Resources

- **Local**: Start with CPU, move to GPU for larger models
- **Cloud**: Google Colab Pro ($10/month) for training
- **University**: Apply for compute cluster access

### Learning Tools

- **Jupyter Notebooks**: For experimentation and visualization
- **GitHub**: Version control, portfolio building
- **Weights & Biases**: Experiment tracking
- **LaTeX/Overleaf**: For writing papers

---

## Study Habits & Best Practices

### Daily Routine (3-4 hours/day)

- **Hour 1**: Watch lecture videos (1.5-2x speed after first watch)
- **Hour 2**: Take notes, work through math by hand
- **Hour 3**: Code implementation, experiments
- **Hour 4**: Read papers, write documentation

### Weekly Goals

- Complete 2-3 lectures worth of material
- Implement 1-2 algorithms from scratch
- Read 1-2 research papers
- Write blog post or documentation

### Active Learning Strategies

1. **Feynman Technique**: Explain concepts out loud
2. **Implementation First**: Code before reading papers
3. **Teach Others**: Write blog posts, help on forums
4. **Regular Review**: Revisit difficult concepts weekly

### Debugging & Understanding

- When stuck, implement from multiple sources
- Draw diagrams of architectures
- Print shapes and intermediate outputs
- Compare your implementation to reference code

---

## Milestone Checkpoints

### After Phase 1 (Month 2):

✓ Can explain bias-variance tradeoff  
✓ Implemented linear regression, logistic regression from scratch  
✓ Understand when to use different ML algorithms

### After Phase 2 (Month 4):

✓ Built neural network library from scratch  
✓ Understand backpropagation mathematically  
✓ Can debug training issues (vanishing gradients, etc.)

### After Phase 3 (Month 5):

✓ Implemented GPT from scratch  
✓ Understand transformer architecture deeply  
✓ Can train small language models

### After Phase 4 (Month 7):

✓ Strong mathematical foundation in linear algebra, probability  
✓ Can derive gradient updates by hand  
✓ Understand optimization landscape

### After Phase 5 (Month 9):

✓ Implemented PPO from scratch  
✓ Trained RL agents on standard benchmarks  
✓ Understand policy gradient methods

### After Phase 6 (Month 10):

✓ Built RLHF pipeline  
✓ Fine-tuned LLM with human feedback  
✓ Ready for workshop paper submission

---

## Resources Quick Reference

### Free Online Courses

- **CS229** (ML Broad): [YouTube](https://www.youtube.com/playlist?list=PLoROMvodv4rMiGQp3WXShtMGgzqpfVfbU)
- **CS189** (ML Math): [Berkeley Course Site](https://people.eecs.berkeley.edu/~jrs/189/)
- **Karpathy Zero to Hero**: [YouTube](https://www.youtube.com/playlist?list=PLAqhIrjkxbuWI23v9cThsA9GvCAUhRvKZ)
- **CS224n** (NLP): [YouTube](https://www.youtube.com/playlist?list=PLoROMvodv4rOSH4v6133s9LFPRHjEmbmJ)
- **CS285** (Deep RL): [YouTube](https://www.youtube.com/playlist?list=PL_iWQOsE6TfVYGEGiAOMaOzzv41Jfm_Ps)

### Books (Free PDFs)

- **Mathematics for ML**: [mml-book.github.io](https://mml-book.github.io/)
- **Deep Learning Book**: [deeplearningbook.org](https://www.deeplearningbook.org/)
- **RL: An Introduction**: [incompleteideas.net](http://incompleteideas.net/book/the-book-2nd.html)

### Implementation Guides

- **Annotated Transformer**: [nlp.seas.harvard.edu](http://nlp.seas.harvard.edu/annotated-transformer/)
- **Spinning Up (OpenAI)**: [spinningup.openai.com](https://spinningup.openai.com/)
- **Hugging Face Course**: [huggingface.co/course](https://huggingface.co/course)

### Paper Reading

- **ArXiv**: Latest research
- **Papers with Code**: Implementations + benchmarks
- **Distill.pub**: Visual explanations

---

## Next Steps After Completion

1. **Start Research Project**: Use knowledge to contribute original work
2. **Industry Internship**: Apply learnings at scale
3. **Open Source**: Contribute to major ML libraries
4. **Graduate School**: Apply with strong technical foundation

This roadmap gives you everything needed to go from ML beginner to research-ready in 6-10 months of focused study



# Comprehensive 2-Year ML Research & Conference Plan

_Strategic roadmap for undergraduate research success in RL/LLM intersection_

## Year 1 (2025): Foundation Building & First Publications

### Spring 2025 (Jan-May)

**Month 1-2: Research Foundation**

- [ ] Complete coursework in: Linear Algebra, Probability, ML fundamentals
- [ ] Self-study: Hugging Face Transformers, PyTorch, basic RL (Sutton & Barto)
- [ ] Reproduce 2-3 key papers: InstructGPT, Constitutional AI, DPO
- [ ] Set up GitHub portfolio with reproductions

**Month 3-4: Mentorship & Lab Integration**

- [ ] Send research emails to 5-10 faculty (use revised email template)
- [ ] Apply for undergraduate research programs at your university
- [ ] Join ML reading groups, attend department seminars
- [ ] Start weekly meetings with identified mentor

**Month 5: Conference Volunteering Applications**

- [ ] Apply for student volunteer positions:
    - ICML 2025 (Vienna, July 21-27) - applications open ~April
    - NeurIPS 2025 (Vancouver, Dec 9-15) - applications open ~August
- [ ] Register for conferences with student rates
- [ ] Plan travel and accommodation

### Summer 2025 (Jun-Aug)

**Focus: First Research Project + ICML Attendance**

**June:**

- [ ] Define focused research question with mentor
- [ ] Literature review and experimental design
- [ ] Begin implementation and experiments

**July:**

- [ ] **Attend ICML 2025** (July 21-27, Vienna)
    - Network with industry researchers
    - Attend workshops: "Foundation Models for Decision Making," "Efficient Systems for Foundation Models"
    - Document contacts and follow up within 1 week
- [ ] Continue experiments, gather preliminary results

**August:**

- [ ] Complete first round of experiments
- [ ] Draft initial workshop paper (4-6 pages)
- [ ] Apply for research internships for next summer

### Fall 2025 (Sep-Dec)

**Target: Workshop Submissions + NeurIPS**

**September:**

- [ ] Submit to NeurIPS 2025 workshops (deadline ~Sept 13):
    - "Instruction Tuning and Instruction Following"
    - "Foundation Models for Decision Making"
    - "Human-Centered AI"
- [ ] Continue refining experiments based on mentor feedback

**October:**

- [ ] Receive workshop reviews, revise papers
- [ ] Apply for Spring 2026 research opportunities
- [ ] Prepare poster presentation

**November-December:**

- [ ] **Attend NeurIPS 2025** (Dec 9-15, Vancouver)
    - Present workshop paper if accepted
    - Network with industry researchers from OpenAI, Anthropic, Google DeepMind
    - Attend main conference sessions on LLMs and RL
- [ ] Plan research direction for Year 2

## Year 2 (2026): Advanced Research & Industry Preparation

### Spring 2026 (Jan-May)

**Focus: Scaling Research + Industry Applications**

**January-February:**

- [ ] Start more ambitious research project (6-month timeline)
- [ ] Apply for summer research internships:
    - Google Brain/DeepMind
    - OpenAI
    - Anthropic
    - Microsoft Research
    - Meta AI Research
- [ ] Submit to ICLR 2026 workshops (deadline ~January)

**March-April:**

- [ ] Continue advanced research project
- [ ] Apply for ICML 2026 student volunteer
- [ ] Write and submit main conference paper to ICML 2026 (deadline ~January)

**May:**

- [ ] Complete spring research project
- [ ] Finalize summer internship plans

### Summer 2026 (Jun-Aug)

**Industry Research Internship**

- [ ] Complete 10-12 week internship at top AI lab
- [ ] Work on production-scale RL/LLM problems
- [ ] Publish internship work as conference paper
- [ ] Build industry network and get return offer consideration

### Fall 2026 (Sep-Dec)

**Capstone Research + Graduate School Prep**

**September-October:**

- [ ] Submit workshop papers to NeurIPS 2026
- [ ] Begin graduate school applications
- [ ] Start senior thesis/capstone project

**November-December:**

- [ ] Attend NeurIPS 2026 as experienced researcher
- [ ] Present multiple papers/posters
- [ ] Interview for graduate positions and industry roles

## Conference Timeline & Deadlines

### Major Conferences (Annual Schedule)

|Conference|Location|Dates|Workshop Deadlines|Student Volunteer Apps|
|---|---|---|---|---|
|**ICLR 2025**|Singapore|May 7-11|Jan 2025|Feb 2025|
|**ICML 2025**|Vienna|Jul 21-27|Apr 2025|Apr 2025|
|**NeurIPS 2025**|Vancouver|Dec 9-15|Sep 2025|Aug 2025|
|**ICLR 2026**|Kigali|May 3-7|Jan 2026|Feb 2026|
|**ICML 2026**|TBD|Jul 2026|Jan 2026|Apr 2026|
|**NeurIPS 2026**|TBD|Dec 2026|Sep 2026|Aug 2026|

### Key Workshop Targets

**NeurIPS Workshops (High Priority):**

- Foundation Models for Decision Making
- Instruction Tuning and Instruction Following
- Human-Centered AI
- Efficient Systems for Foundation Models

**ICML Workshops:**

- Reinforcement Learning for Real Life
- Machine Learning for Systems
- Theoretical Foundations of Reinforcement Learning

**ICLR Workshops:**

- Large Language Models for Decision Making
- Trustworthy ML
- Mathematical Reasoning and AI

## Networking Strategy

### Industry Contacts to Target

**Key Companies & Labs:**

- **OpenAI**: RLHF team, Safety team
- **Anthropic**: Constitutional AI researchers
- **Google DeepMind**: Gemini team, RL researchers
- **Meta AI**: LLaMA team, FAIR researchers
- **Microsoft Research**: GPT team, RL group

### Academic Contacts

- **Top RL/LLM researchers** to follow and potentially collaborate with
- **Graduate students** at target PhD programs
- **Postdocs** looking for industry positions (good mentors)

## Resource Requirements

### Financial Planning

- **Conference costs per year**: ~$2,000-3,000
    - Registration: $100-200 (student rates)
    - Travel: $500-1,500 per conference
    - Accommodation: $400-800 per conference
- **Compute costs**: $200-500 per year (cloud computing)
- **Total annual budget**: $2,500-4,000

### Technical Infrastructure

- **Computing**: GPU access through university or cloud credits
- **Software**: GitHub Pro, cloud storage, reference management
- **Hardware**: Laptop capable of development, good internet

## Success Metrics

### Year 1 Goals

- [ ] 1-2 workshop paper acceptances
- [ ] Established mentorship relationship
- [ ] Strong network of 20+ industry/academic contacts
- [ ] Solid technical portfolio on GitHub

### Year 2 Goals

- [ ] 1+ main conference paper submission
- [ ] Summer internship at top AI lab
- [ ] Graduate school acceptances or industry job offers
- [ ] Recognition as emerging researcher in field

## Contingency Plans

### If workshop papers are rejected:

- Revise and resubmit to next cycle
- Present at local conferences or symposiums
- Use as foundation for stronger future work

### If no industry internship:

- University REU programs
- Open source contributions to major projects
- Independent research with publication goals

### If research direction isn't working:

- Pivot to adjacent areas (CV+RL, Robotics+RL)
- Focus on reproducibility and meta-analysis studies
- Collaborate with multiple labs to diversify portfolio

## Action Items for Next 30 Days

1. **Week 1**: Send research emails to 3-5 faculty members
2. **Week 2**: Apply for undergraduate research programs
3. **Week 3**: Set up development environment and reproduce first paper
4. **Week 4**: Join ML reading groups and attend first conference talk

---

_This plan is designed to be used with tools like Perplexity to find specific opportunities, deadlines, and contact information for each milestone._