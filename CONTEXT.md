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

## Ending membership and content

**Remove**:
To take a Member out of a Team (an Owner removes someone, or a Member leaves). The person loses access, but the Ideas and Comments they wrote stay and keep their display name.
_Avoid_: Delete a member, kick, ban

**Delete**:
To permanently erase a Team or a Board together with everything inside it. There is no undo. Ideas and Comments are never deleted, only hidden.
_Avoid_: Archive, deactivate, remove (reserved for Members)

## Access links

**Owner link**:
A secret link, shown once when a Team is created, that signs the holder in as the Owner.

**Member invite link**:
A secret, expiring, revocable link that lets someone join a Team as a Member.
_Avoid_: Invitation (implies an email)

**Board share link**:
A secret, rotatable link that grants a Visitor access to one Private board.

**Redeem**:
To open an access link and press "Continue", which uses the link to sign in (Owner link), join the Team (Member invite link) or gain access (Board share link). Opening the link alone never redeems it.
_Avoid_: Accept, claim, activate

**Session**:
A signed-in Member's 30-day login on one device, ended by sign-out, removal from the Team or expiry. Not the same as a Visitor's anonymous cookie.
_Avoid_: Account, token (the token is the secret that proves a Session)
