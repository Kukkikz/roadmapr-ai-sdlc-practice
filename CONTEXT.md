# Roadmapr

A multi-tenant feedback board where teams collect ideas from visitors and publish a roadmap of what is planned, in progress and shipped.

## Language

**Team**:
An organisation that owns one or more Boards and has Members. Anyone may create a Team.
_Avoid_: Workspace, organisation, tenant

**Board**:
A named collection of Ideas owned by a Team, either public or private.
_Avoid_: Project, space

**Public board**:
A Board that anyone can browse and participate in.

**Private board**:
A Board that only visitors holding its Board share link (and the Team's Members) can see; everyone else gets "not found".
_Avoid_: Members-only, unlisted

**Idea**:
A piece of feedback submitted to a Board, with a status of open, planned, in progress, shipped or declined.
_Avoid_: Feature request, suggestion, post

## People

**Visitor**:
Someone who participates in a Board without signing in, identified only by an anonymous cookie.
_Avoid_: User, guest, customer

**Member**:
A person with team powers (change status, manage tags, hide Ideas, reply as the team), identified by a display name rather than an account.
_Avoid_: User, admin, staff

**Owner**:
A Member who can also manage links, remove Members and manage Boards. A Team always has at least one.

**Actor**:
Whoever authors an Idea, Vote or Comment: either a Visitor or a Member. A Member always acts as themselves, never as their anonymous cookie.
_Avoid_: Author (ambiguous), voter

## Access links

**Owner link**:
A secret link, shown once when a Team is created, that signs the holder in as the Owner.

**Member invite link**:
A secret, expiring, revocable link that lets someone join a Team as a Member.
_Avoid_: Invitation (implies an email)

**Board share link**:
A secret, rotatable link that grants a Visitor access to one Private board.
