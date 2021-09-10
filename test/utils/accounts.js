const people = {};

const setPeople = (accs) => {
  people.owner = accs[0];
  people.alice = accs[1];
  people.bob = accs[2];
  people.charlie = accs[3];
  people.tod = accs[4];
  people.carol = accs[3];
};

module.exports = {
  setPeople,
  people,
};
