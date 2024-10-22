# Learnings from building a Graph AI Agent Framework

## How did I get here?

When we started building reliability systems to grade how an AI agent was performing, we had a few goals:

1. Understand how the agent is performing given a goal
2. Understand the context surrounding the agent's goal and how it impacts the agent's performance
3. Provide actionable insights to help the agent improve

Our intuition said that grading the agent's performance would be possible if we had a good understanding of the surrounding environment and systems. To understand context I built thread-safe tracing library (writing this in python is not something I would do again LOL). 
As we started building this system (back in December 2023 or so) and continued to iterate till ~ June 2024, we realized that agents were still too nascent to be used in production. Given we persuing b2b SaaS (ofc), we had to explore different options.

There were a couple main issues we found when speaking with business who were interested in using agents:
Agents were too:
1. Brittle and would often hallucinate or not perform as expected
2. Rigid and couldn't handle the nuances of real world tasks
3. Dumb and couldn't solve anything without explicit instructions
4. Expensive to build and maintain

We found ourselves having to pitch building AI Agents before we could even pitch our system. This sucked.

So we started exploring different options. We had had this idea of structuring agents as a graph (this is pre-langgraph days), and thought that this might be a good way to address some of the issues above.

## Building DAGent

DAGent - Directed Acyclic Graphs as AI Agents

The idea behind DAGent was to have a lightweight way to structure agents as a graph and have strong opinions on what the graph should look like. The agents that I thought would be most useful were ones that could be extremely constrained on what the possible steps it could take. It can be argued that these are less so agents and more so workflows but idc about the distinction.

There were a few main ideas that I had when building this:
1. Ability to structure workflows as graphs
2. Deal with all the annoying shit which comes with building agents like making json schemas for function calls for the agent. (idk why we had some of this in the first place)
3. Pass necessary context to the agent so that it can make better decisions
4. Don't overburden the user with setting up the framework and dealing with uncessary jargon.

## Learnings

I'm not going to dive into the details of this framework as the github does a great job at that Extensible-AI/DAGent.

As for my learnings, I had to become the user of my own framework to make sure it was as frictionless as possible. I iterated and improved the framework based on my own needs. Looking back, I might have over-indexed on my needs, but again, IMO if I couldn't make good use of it, I couldn't expect others to either.

1. **Strong opinions on what the graph should look like** - I had to make a lot of decisions on what the graph should look like and how it should behave. This was a blessing and a curse. A blessing as the design fit most of the needs of workflow based agents that I had in mind. A curse, as I was limited by my own design in a few ways.

   - First, I could not have cycles in the graph. While this is not actually enforced in the framework, the design makes it so that you don't have perpetual running agents.
   - Second, I should have run the pattern of the framework a bit more with other people to see how it could be used in practice.

2. **Building a simple experience** - I wasn't sure if I could build a simple experience while having strong opinions on the framework. I think I succeeded but it was a bit of a struggle to balance the abilities to give to the user, and the simplicity to use the framework. One of the reasons I go back to my own framework is because of how simple it is. I hated writing those JSON schemas for the agent functions and it is so simple to integrate those with the framework. A big plus that langchain has right now is that they have a lot of code written already which make it easier to just get into building agents - things like markdown loaders, rag tools, etc. IMO these are great for prorotyping and getting started, but less so for building production ready, and reliable systems. Another thing that 

3. **Context Managment** - While this is something that I don't stress on a lot in the docs of the framework, there is enough ability to pass context to the agents that you can build some really powerful workflows with a high reliability rate. I was able to get DAGent working for things like my calendar agent with a 90%+ success rate, < 100 lines of code, and with an 8B model running with Ollama. I keep coming back to this, but truly you can make use of smaller models to build some really powerful workflows when you have the right context. Even with the entropix work [link](link), I strongly believe that we'd be able to reduce entropy and varentropy with improvements in context management (think RAG and system information passed in).
