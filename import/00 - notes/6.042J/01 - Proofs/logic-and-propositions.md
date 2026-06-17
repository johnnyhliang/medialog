---
layout: layout.njk
tags:
  - pages
  - proofs
title: Logic & Propositions
date: 
eleventyNavigation:
  key: 03. Logic & Propositions
  order: 6
---

# Logic & Propositions

In place of specific propositions, usually the letters $P$ or $Q$ are used to indicate that these can only take on the values **T** (true) or **F** (false). 

#### Connectives:
These are the connectives that are mostly used:

| **connective** | **symbol** |  |
--- | --- | ---
| negation | $\neg P$ (or $\overline P$) | "not"
| conjunction | $P \land Q$ | "and" 
| disjunction | $P \lor Q$ | "or"
| exclusive disjunction | $P \oplus Q$ | "xor (exclusive or)"
| implication | $P \implies Q$ | "if ... then"
| biconditional | $P \iff Q$ | "iff" ("if and only if")

- **Negation** just inverses the truth value of a proposition. 
- A **conjunction** is true only if both propositions are true.
- A **disjunction** is true if one of the propositions is true. 
- An **exclusive disjunction**, "exclusive or (XOR)," is true when the both of the propositions are of different truth values. 
- A **biconditional** is true when both of the propositions are of the same value.
- An **implication** is only false when the antecedent (the "**if** part") is true, and the consequent (the "**then** part") is false; in all other cases it is true. In fact, let's take a look at one example:
  The statement is: "_If Goldbach's conjecture is true, then $x^2 \geq 0$ for every real number $x$_."
  
  Remember that [Goldbach's conjecture](https://en.wikipedia.org/wiki/Goldbach%27s_conjecture) says that _every even integer greater than 2 is the sum of two primes_.
  
  We don't know for certain if it is true or not, but "_$x^2 \geq 0$ for every real number $x$_" is definitely true. So, it doesn't matter if the antecedent (_If Goldbach's conjecture is true_) is true or not, the fact that the consequent (_then $x^2 \geq 0$ for every real number $x$_) is true makes the whole proposition true.

---
From an implication ($p \implies q$), we can construct 3 new conditional statements:

- ==converse== ($q \implies p$)  — switching $p$ and $q$
- ==inverse== ($\neg p \implies \neg q$) —  negate both $p$ and $q$
- ==contrapositive== ($\neg q \implies \neg p$) —  switch & negate both $p$ and $q$


An implication and its contrapositive are equivalent: 
$$P \implies Q = \neg Q \implies \neg P$$

An implication **and** its converse is the same as the biconditional:
$$(P \implies Q) \land (Q \implies P) = P \iff Q$$

----

A ==tautology== is a proposition that is always true (e.g., $p \lor \neg p$)

A ==contradiction== is a proposition that is always false (e.g., $p \land \neg p$)

A ==contingency== is a proposition that is neither a tautology nor a contradiction (e.g., $p$)

#### Equivalence
Assignment of values to variables is called an _environment_.
For example, environment $v$ assigning truth values to $P$, $Q$, and $R$: $v(P) = T, \ v(Q) = T, \ v(R) = F$.
Two propositional formulas are _equivalent_ iff they have the same truth value in all environments. That is, the compound propositions $p$ and $q$ are logically equivalent if $p \implies q$ is a tautology.  Equivalency is denoted as $p \equiv q$ (e.g., $\neg p \lor q \equiv p \implies q$).

An example is **De Morgan's Laws**:

| |
| :--- |
| $$\neg (p \lor q) \equiv \neg p \land \neg q$$ |

| |
| :--- |
| $$\neg (p \land q) \equiv \neg p \lor \neg q$$ |


---
A _half adder_ is a digital circuit that adds two 1-bit numbers. A _full adder_ also adds two 1-bit numbers, but the difference is that a half adder does not have a _carry_ input while a full adder does. (Carry is the same thing when you do decimal addition, for example, with $21 + 9$, you first add $9$ and $1$, the result is $10$, so you _carry_ the $1$ to add it to $2$.)

| **1-bit half adder** | **1-bit full adder** |
| --- | --- |
| ![1-bit half adder](https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/1-bit_half-adder.svg/215px-1-bit_half-adder.svg.png) |  ![1-bit full adder](https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Full_Adder_Block.svg/200px-Full_Adder_Block.svg.png) |


A binary addition circuit example (a "ripple carry") is as follows:

<img src="https://raw.githubusercontent.com/rivea0/bite-sized-math-for-cs/main/notes/unit-01-proofs/images/lgate.png" alt="Binary addition circuit example" width="50%" >

We can say that $d_0$ is $a_0 \oplus b_0$, and $c_0$ is $a_0 \land b_0$.
(Imagine $a_0$ as $1$, and $b_0$ as $1$, adding them will result in $2$ which is $10$ in binary — so, you write $0$ and carry the $1$, and the operations hold. The bit you write is the **xor** of two bits, and the carry is the **and** of them).

If we define $s_i$ to be $a_i \oplus b_i$, and $d_i$ to be $c_{i - 1} \oplus s_i$, $c_i$ is going to be $(c_{i - 1} \land s_i) \lor (a_i \land b_i)$.

What does it mean? Let's see.

|  |
| :--- |
| Let's say $a_0$ is $1$, and $b_0$ is $0$. |
| $s_0$ is going to be the sum of them (the operation XOR), which is $1$. |
| $d_0$ is going to be the XOR of the carry from before ($c_{0 - 1 }$) and the sum ($s_0$). We don't have a carry from a previous addition as there is none (that would be $c_{-1}$!), so it is $0$. $s_0$ was $1$.  The XOR of them is $1$, so $d_0$ is $1$. |
| We already know we don't have a carry ($1 + 0$ doesn't have a carry), but still, let's continue decoding the formula. |
| $c_0$ which is our carry has to be $(c_{0 - 1} \land s_0) \lor (a_0 \land b_0)$. |
| Plugging in our values, we get $(0 \land 1) \lor (1 \land 0)$. It results in $0 \lor 0$, so the final result is $0$, which is our carry! |

---

#### Satisfiability & Validity

A formula is _satisfiable_ iff it is true in some environment (which can _sometimes_ be true), for example, $P$.

An example of a formula that is not satisfiable is $P \land \neg P$. 

A formula is _valid_ iff it is true in all environments (which is _always_ true), for example, $P \lor (\neg P)$ (also called a _tautology_).
